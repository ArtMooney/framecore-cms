import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { after, before, beforeEach, test } from "node:test";
import { H3 } from "h3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
  createResetToken,
  isValidResetToken,
  RESET_TOKEN_TTL,
} from "../runtime/server/routes/utils/reset-token.js";
import {
  hashPassword,
  verifyPassword,
} from "../runtime/server/routes/utils/password.js";

const fixtureKey = Symbol.for("framecore-cms.reset-test");
const fixture = {
  schema: {
    users: sqliteTable("admin_accounts", {
      id: integer("id").primaryKey(),
      email: text("email"),
      password: text("password"),
      resetId: text("reset_id"),
    }),
  },
  runtimeConfig: {
    userName: "public-site",
    userPass: "public-key",
    cmsMailgunDomain: "mg.example.test",
    cmsMailgunBaseUrl: "https://api.mailgun.test/",
    emailFrom: "CMS <cms@example.test>",
    mailgunApiKey: "test-key",
  },
  sentEmails: [],
  failEmail: false,
};
globalThis[fixtureKey] = fixture;

const fixtureSource = `const fixture = globalThis[Symbol.for("framecore-cms.reset-test")];`;
const sources = {
  "#framecore-cms/config": `${fixtureSource} export const { schema } = fixture;`,
  "nuxt/internal/server-runtime-config": `${fixtureSource}
    export const useRuntimeConfig = () => fixture.runtimeConfig;`,
  ofetch: `${fixtureSource}
    export const $fetch = async (url, options) => {
      if (fixture.failEmail) throw new Error("Email service unavailable");
      fixture.sentEmails.push({url, options});
      return {id: "message-id"};
    };`,
};
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(sources, specifier)) {
      return {
        url: `data:text/javascript,${encodeURIComponent(sources[specifier])}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const sqlite = new DatabaseSync(":memory:");
const d1 = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    let values = [];
    return {
      bind(...parameters) {
        values = parameters;
        return this;
      },
      async raw() {
        return statement.all(...values).map((row) => Object.values(row));
      },
      async all() {
        return { results: statement.all(...values) };
      },
      async run() {
        statement.run(...values);
        return { success: true };
      },
    };
  },
};
const routes = {};
let originalPassword;

before(async () => {
  sqlite.exec(
    "CREATE TABLE admin_accounts (id INTEGER PRIMARY KEY, email TEXT, password TEXT, reset_id TEXT)",
  );
  originalPassword = await hashPassword("original-password");
  for (const name of ["reset", "validate", "new-password"]) {
    routes[name] = (
      await import(`../runtime/server/routes/${name}.js`)
    ).default;
  }
});

beforeEach(() => {
  sqlite.exec("DELETE FROM admin_accounts");
  sqlite
    .prepare("INSERT INTO admin_accounts VALUES (1, ?, ?, NULL)")
    .run("Admin@example.test", originalPassword);
  fixture.sentEmails = [];
  fixture.failEmail = false;
});

after(() => {
  hooks.deregister();
  sqlite.close();
  delete globalThis[fixtureKey];
});

async function request(
  name,
  body,
  {
    method = "POST",
    authorized = true,
    origin = "https://site.example.test",
    cloudflareUrl,
    headers = {},
  } = {},
) {
  const app = new H3({ silent: true });
  app.all("/**", async (event) => {
    event.context.cloudflare = {
      env: { DB: d1 },
      ...(cloudflareUrl ? { request: new Request(cloudflareUrl) } : {}),
    };
    return routes[name](event);
  });
  const response = await app.fetch(
    new Request(`${origin}/cms/${name}`, {
      method,
      headers: {
        ...(authorized
          ? { Authorization: `Basic ${btoa("public-site:public-key")}` }
          : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  return { status: response.status, body: await response.text() };
}

function storeToken(token) {
  sqlite.prepare("UPDATE admin_accounts SET reset_id = ?").run(token);
}

test("reset endpoints require POST, Basic authorization and string input", async () => {
  for (const name of Object.keys(routes)) {
    assert.equal(
      (await request(name, undefined, { method: "GET" })).status,
      405,
    );
    assert.equal((await request(name, {}, { authorized: false })).status, 401);
    assert.equal((await request(name, {})).status, 400);
  }
  assert.equal((await request("reset", { email: [] })).status, 400);
  assert.equal((await request("validate", { validation: {} })).status, 400);
  assert.equal(
    (await request("new-password", { password: {}, validation: "token" }))
      .status,
    400,
  );
});

test("unknown email addresses and SQL patterns return the same generic response", async () => {
  for (const email of ["missing@example.test", "%", "_dmin@example.test"]) {
    const response = await request("reset", { email });
    assert.deepEqual(response, { status: 200, body: "ok" });
  }
  assert.equal(fixture.sentEmails.length, 0);
  assert.equal(
    sqlite.prepare("SELECT reset_id FROM admin_accounts").get().reset_id,
    null,
  );
});

test("reset links use the site's origin and the stored email address", async () => {
  const response = await request("reset", {
    email: " admin@EXAMPLE.test ",
    pageuri: "https://another.example.test/steal-token?existing=query",
  });
  assert.equal(response.status, 200);
  const token = sqlite
    .prepare("SELECT reset_id FROM admin_accounts")
    .get().reset_id;
  assert.equal(isValidResetToken(token), true);
  assert.equal(fixture.sentEmails.length, 1);
  const message = fixture.sentEmails[0].options.body;
  assert.equal(message.get("to"), "Admin@example.test");
  assert.ok(
    message
      .get("text")
      .includes(`https://site.example.test/admin?validation=${token}`),
  );
  assert.ok(!message.get("text").includes("another.example.test"));
});

test("reset tokens expire after 30 minutes and reject future or old-style codes", async () => {
  const now = Date.now();
  const token = createResetToken(now);
  assert.equal(isValidResetToken(token, now), true);
  assert.equal(isValidResetToken(token, now + RESET_TOKEN_TTL - 1), true);
  assert.equal(isValidResetToken(token, now + RESET_TOKEN_TTL), false);
  for (const invalid of [
    "%",
    "_",
    crypto.randomUUID(),
    createResetToken(now - RESET_TOKEN_TTL - 1000),
    createResetToken(now + 60000),
  ]) {
    storeToken(invalid);
    assert.equal(
      (await request("validate", { validation: invalid })).status,
      404,
    );
    assert.equal(
      (
        await request("new-password", {
          validation: invalid,
          password: "replacement",
        })
      ).status,
      404,
    );
  }
  assert.equal(
    sqlite.prepare("SELECT password FROM admin_accounts").get().password,
    originalPassword,
  );
});

test("SQL wildcard codes cannot match a real stored reset token", async () => {
  storeToken(createResetToken());
  for (const validation of ["%", "_", `${Date.now()}.%`]) {
    assert.equal((await request("validate", { validation })).status, 404);
    assert.equal(
      (await request("new-password", { validation, password: "replacement" }))
        .status,
      404,
    );
  }
});

test("a reset code changes the password once and preserves the hash format", async () => {
  const validation = createResetToken();
  storeToken(validation);
  assert.equal((await request("validate", { validation })).status, 200);
  assert.equal(
    (await request("new-password", { validation, password: "replacement" }))
      .status,
    200,
  );
  const user = sqlite
    .prepare("SELECT password, reset_id FROM admin_accounts")
    .get();
  assert.equal(await verifyPassword("replacement", user.password), true);
  assert.equal(user.reset_id, "");
  assert.equal((await request("validate", { validation })).status, 404);
  assert.equal(
    (
      await request("new-password", {
        validation,
        password: "another-password",
      })
    ).status,
    404,
  );
});

test("simultaneous requests can only consume a reset token once", async () => {
  const validation = createResetToken();
  storeToken(validation);
  const responses = await Promise.all([
    request("new-password", { validation, password: "first-password" }),
    request("new-password", { validation, password: "second-password" }),
  ]);
  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 404]);
});

test("a failed notification does not report a saved password change as failed", async (context) => {
  const validation = createResetToken();
  storeToken(validation);
  fixture.failEmail = true;
  context.mock.method(console, "error", () => {});
  assert.equal(
    (await request("new-password", { validation, password: "replacement" }))
      .status,
    200,
  );
  assert.equal(
    await verifyPassword(
      "replacement",
      sqlite.prepare("SELECT password FROM admin_accounts").get().password,
    ),
    true,
  );
});

test("reset links keep Cloudflare's external HTTPS origin despite internal HTTP and forged forwarding headers", async () => {
  const response = await request(
    "reset",
    {
      email: "admin@example.test",
      pageuri: "https://client.example/steal-token",
    },
    {
      origin: "http://localhost:3000",
      cloudflareUrl: "https://site.example.test/cms/reset",
      headers: {
        "X-Forwarded-Host": "attacker.example",
        "X-Forwarded-Proto": "http",
      },
    },
  );
  assert.equal(response.status, 200);
  assert.equal(fixture.sentEmails.length, 1);
  const token = sqlite
    .prepare("SELECT reset_id FROM admin_accounts")
    .get().reset_id;
  const message = fixture.sentEmails[0].options.body.get("text");
  assert.ok(
    message.includes(`https://site.example.test/admin?validation=${token}`),
  );
  assert.ok(!message.includes("localhost"));
  assert.ok(!message.includes("attacker.example"));
  assert.ok(!message.includes("client.example"));
});
