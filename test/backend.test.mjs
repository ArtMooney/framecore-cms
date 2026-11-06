import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { H3 } from "h3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const fixtureKey = Symbol.for("framecore-cms.backend-test");
const fixture = {
  schema: {
    users: sqliteTable("admin_accounts", {
      id: integer("id").primaryKey(),
      email: text("email"),
      password: text("password"),
      resetId: text("reset_id"),
    }),
    products: sqliteTable("site_products", {
      id: integer("id").primaryKey({ autoIncrement: true }),
      name: text("name"),
      sortOrder: integer("sort_order"),
    }),
    archive: sqliteTable("product_archive", {
      id: integer("id").primaryKey({ autoIncrement: true }),
      name: text("name"),
      sortOrder: integer("sort_order"),
    }),
    static_content: sqliteTable("page_content", {
      id: integer("id").primaryKey(),
      title: text("title"),
      content: text("content", { mode: "json" }),
    }),
  },
  cmsTables: [
    { id: "products", name: "Products", viewMode: "list" },
    {
      id: "archive",
      name: "Archive",
      viewMode: "graph",
      backupRef: "products",
    },
    { id: "static_content", name: "Content", viewMode: "list" },
  ],
  fieldsConfig: {
    products: {
      id: { type: "integer", label: "", required: true, hidden: true },
      name: { type: "text", label: "Product", required: true, hidden: false },
      sortOrder: { type: "integer", label: "", required: false, hidden: true },
    },
  },
  graphConfig: { products: [{ type: "bar", labelField: "name" }] },
  staticContentTypes: { "Product page": { header: { image: "fileImg" } } },
  runtimeConfig: {
    userName: "public-site",
    userPass: "public-key",
    cmsSessionPassword: "test-session-secret-with-at-least-32-characters",
    cmsMailgunDomain: "mg.example.test",
    cmsMailgunBaseUrl: "https://api.mailgun.test/",
  },
  sentEmail: null,
};
globalThis[fixtureKey] = fixture;

const fixtureSource = `const fixture = globalThis[Symbol.for("framecore-cms.backend-test")];`;
const sources = {
  "#framecore-cms/config": `${fixtureSource}
    export const { schema, cmsTables, fieldsConfig, graphConfig, staticContentTypes } = fixture;`,
  "nuxt/internal/server-runtime-config": `${fixtureSource}
    export const useRuntimeConfig = () => fixture.runtimeConfig;`,
  ofetch: `${fixtureSource}
    export const $fetch = async (url, options) => {
      fixture.sentEmail = {url, options};
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

// Run the real Drizzle D1 driver against in-memory SQLite through the D1 API.
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
  async batch(statements) {
    return Promise.all(statements.map((statement) => statement.all()));
  },
};
const bucket = {
  files: new Map(),
  async head(key) {
    return this.files.has(key) ? { key } : null;
  },
  async put(key, bytes, metadata) {
    this.files.set(key, { bytes, metadata });
  },
  async delete(key) {
    this.files.delete(key);
  },
};
const credentials = { email: "admin@example.test", password: "admin-password" };
const routes = {};
let adminCookie;

before(async () => {
  sqlite.exec(`
    CREATE TABLE admin_accounts (id INTEGER PRIMARY KEY, email TEXT, password TEXT, reset_id TEXT);
    CREATE TABLE site_products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, sort_order INTEGER);
    CREATE TABLE product_archive (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, sort_order INTEGER);
    CREATE TABLE page_content (id INTEGER PRIMARY KEY, title TEXT, content TEXT);
    INSERT INTO site_products (name, sort_order) VALUES ('Second', 2), ('First', 1);
    INSERT INTO page_content VALUES (1, 'Home', '{"title":"Welcome"}');
  `);
  const { hashPassword } =
    await import("../runtime/server/routes/utils/password.js");
  const passwordHash = await hashPassword(credentials.password);
  sqlite
    .prepare("INSERT INTO admin_accounts (email, password) VALUES (?, ?)")
    .run(credentials.email, passwordHash);

  for (const name of [
    "tables",
    "config",
    "fields",
    "rows",
    "add-item",
    "add-items",
    "delete-items",
    "save-sort-order",
    "save-item",
    "delete-item",
    "static",
    "login",
    "session",
    "logout",
    "new-password",
  ]) {
    routes[name] = (
      await import(`../runtime/server/routes/${name}.js`)
    ).default;
  }
  const login = await request("login", credentials, { cookie: "" });
  assert.equal(login.status, 200);
  adminCookie = sessionCookie(login);
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
    authorized = true,
    cookie = adminCookie,
    headers = {},
    method = body === undefined ? "GET" : "POST",
    origin = "https://site.example.test",
    cloudflareUrl,
    env = {},
  } = {},
) {
  const app = new H3({ silent: true });
  app.all("/**", async (event) => {
    event.context.cloudflare = {
      env: { DB: d1, FILES: bucket, ...env },
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
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  return {
    status: response.status,
    body: data,
    cookies: response.headers.getSetCookie(),
    cacheControl: response.headers.get("cache-control"),
  };
}

function sessionCookie(response) {
  const cookie = response.cookies.find((value) =>
    value.startsWith("framecore-cms-session="),
  );
  assert.ok(cookie, "response must contain the CMS session cookie");
  return cookie.split(";", 1)[0];
}

test("metadata uses host configuration and requires the server session", async () => {
  const tables = await request("tables", {});
  assert.equal(tables.status, 200);
  assert.deepEqual(tables.body, fixture.cmsTables);

  const config = await request("config", {});
  assert.equal(config.status, 200);
  assert.deepEqual(config.body, {
    graphConfig: fixture.graphConfig,
    staticContentTypes: fixture.staticContentTypes,
  });
  assert.equal(
    (await request("config", credentials, { cookie: "" })).status,
    401,
  );
  assert.equal(
    (await request("config", {}, { authorized: false })).status,
    401,
  );
});

test("CRUD and sorting work with a host table outside the original site schema", async () => {
  const fields = await request("fields", {
    table_id: "products",
  });
  assert.equal(fields.status, 200);
  assert.deepEqual(
    fields.body.map((field) => field.name),
    ["id", "name", "sortOrder"],
  );
  assert.equal(fields.body[1].label, "Product");

  const rows = await request("rows", { table_id: "products" });
  assert.equal(rows.status, 200);
  assert.deepEqual(
    rows.body.map((row) => row.name),
    ["First", "Second"],
  );

  const base = { table_id: "products", schema: [] };
  const added = await request("add-item", {
    ...base,
    item: { name: "New", sortOrder: 3 },
  });
  assert.equal(added.status, 200);
  assert.equal(added.body.name, "New");

  const saved = await request("save-item", {
    ...base,
    item: { ...added.body, name: "Updated" },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.name, "Updated");

  const deleted = await request("delete-item", { ...base, item: saved.body });
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.body, { success: true });
  assert.equal(
    sqlite.prepare("SELECT COUNT(*) AS count FROM site_products").get().count,
    2,
  );
  assert.equal((await request("rows", { table_id: "users" })).status, 400);
});

test("public static content and login retain their existing API contracts", async () => {
  const content = await request("static");
  assert.equal(content.status, 200);
  assert.deepEqual(content.body[0].content, { title: "Welcome" });
  assert.equal(
    (await request("static", undefined, { authorized: false, cookie: "" }))
      .status,
    401,
  );
  assert.deepEqual((await request("login", credentials)).body, {
    success: true,
    data: { message: "Logged in successfully" },
  });
  assert.equal(
    (await request("login", { ...credentials, password: "wrong" })).status,
    401,
  );
});

test("nested file handling reads the host content template", async () => {
  const { handleJsonFileUploads } =
    await import("../runtime/server/routes/utils/json-file-handler.js");
  const uploads = [];
  const item = {
    title: "Product page",
    content: {
      header: {
        image: [
          { name: "hero.png", file: btoa("pixels"), contentType: "image/png" },
        ],
      },
    },
  };
  await handleJsonFileUploads(
    {
      async put(key, bytes, metadata) {
        uploads.push({ key, bytes, metadata });
      },
    },
    item,
    [{ name: "content", type: "json" }],
  );
  assert.equal(uploads.length, 1);
  assert.match(uploads[0].key, /^cms-files\/hero-\d+\.png$/);
  assert.equal(new TextDecoder().decode(uploads[0].bytes), "pixels");
  assert.equal(uploads[0].metadata.httpMetadata.contentType, "image/png");
  assert.equal(
    item.content.header.image,
    uploads[0].key.slice("cms-files/".length),
  );
});

test("password reset email uses the configured Mailgun account and endpoint", async () => {
  const { sendEmail } =
    await import("../runtime/server/routes/utils/send-email.js");
  assert.deepEqual(
    await sendEmail(
      "from@example.test",
      credentials.email,
      "Reset",
      "Reset link",
      "api-key",
    ),
    { id: "message-id" },
  );
  assert.equal(
    fixture.sentEmail.url,
    "https://api.mailgun.test/v3/mg.example.test/messages",
  );
  assert.equal(
    fixture.sentEmail.options.headers.Authorization,
    `Basic ${btoa("api:api-key")}`,
  );
  assert.equal(fixture.sentEmail.options.body.get("to"), credentials.email);
  assert.equal(fixture.sentEmail.options.body.get("text"), "Reset link");
});

test("bulk archive operations retain backupRef behavior and chunked writes", async () => {
  const archive = fixture.cmsTables.find((table) => table.id === "archive");
  const items = Array.from({ length: 12 }, (_, index) => ({
    id: index + 100,
    name: `Expired ${index + 1}`,
    sortOrder: index + 1,
  }));
  const source = { table_id: archive.backupRef };
  assert.equal((await request("add-items", { ...source, items })).status, 200);
  const sourceRows = (await request("rows", source)).body;
  const expired = sourceRows.filter((row) => row.name.startsWith("Expired"));
  assert.equal(expired.length, 12);
  // Bulk inserts deliberately discard IDs from the source table.
  assert.ok(expired.every((row) => row.id < 100));

  const target = { table_id: archive.id };
  assert.equal(
    (await request("add-items", { ...target, items: expired })).status,
    200,
  );
  assert.equal(
    (await request("delete-items", { ...source, items: expired })).status,
    200,
  );
  assert.equal((await request("rows", source)).body.length, 2);
  const archived = (await request("rows", target)).body;
  assert.deepEqual(
    archived.map((row) => row.name),
    items.map((item) => item.name),
  );

  const reordered = archived.map((item, index) => ({
    ...item,
    sortOrder: archived.length - index,
  }));
  assert.equal(
    (await request("save-sort-order", { ...target, items: reordered })).status,
    200,
  );
  assert.deepEqual(
    (await request("rows", target)).body.map((row) => row.name),
    items.map((item) => item.name).reverse(),
  );
  assert.deepEqual(
    (await request("add-items", { ...target, items: [] })).body,
    { success: true },
  );
  assert.deepEqual(
    (await request("delete-items", { ...target, items: [] })).body,
    { success: true },
  );
});

test("nested content file updates preserve, replace and clean up stored files", async () => {
  const base = {
    table_id: "static_content",
    schema: [{ name: "content", type: "json" }],
  };
  const upload = (name, contents) => [
    { name, file: btoa(contents), contentType: "image/png" },
  ];
  const created = await request("add-item", {
    ...base,
    item: {
      title: "Product page",
      content: { header: { image: upload("original.png", "original pixels") } },
    },
  });
  assert.equal(created.status, 200);
  const originalKey = `cms-files/${created.body.content.header.image}`;
  assert.equal(bucket.files.size, 1);
  assert.equal(
    new TextDecoder().decode(bucket.files.get(originalKey).bytes),
    "original pixels",
  );

  const unchanged = await request("save-item", { ...base, item: created.body });
  assert.equal(unchanged.status, 200);
  assert.equal(bucket.files.size, 1);
  assert.ok(bucket.files.has(originalKey));

  const replaced = await request("save-item", {
    ...base,
    item: {
      ...created.body,
      content: { header: { image: upload("replacement.png", "new pixels") } },
    },
  });
  assert.equal(replaced.status, 200);
  const replacementKey = `cms-files/${replaced.body.content.header.image}`;
  assert.ok(!bucket.files.has(originalKey));
  assert.equal(bucket.files.size, 1);
  assert.equal(
    new TextDecoder().decode(bucket.files.get(replacementKey).bytes),
    "new pixels",
  );
  const storedContent = sqlite
    .prepare("SELECT content FROM page_content WHERE id = ?")
    .get(created.body.id).content;
  assert.equal(
    JSON.parse(storedContent).header.image,
    replaced.body.content.header.image,
  );

  const deleted = await request("delete-item", {
    ...base,
    item: replaced.body,
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(deleted.body, { success: true });
  assert.equal(bucket.files.size, 0);
  assert.equal(
    sqlite
      .prepare("SELECT COUNT(*) AS count FROM page_content WHERE id = ?")
      .get(created.body.id).count,
    0,
  );
});

test("login creates a private cookie and restores authentication without browser-stored credentials", async () => {
  const loggedIn = await request("login", credentials, { cookie: "" });
  assert.equal(loggedIn.status, 200);
  const cookie = sessionCookie(loggedIn);
  const setCookie = loggedIn.cookies.find((value) =>
    value.startsWith("framecore-cms-session="),
  );
  assert.match(setCookie, /; HttpOnly/i);
  assert.match(setCookie, /; Secure/i);
  assert.match(setCookie, /; SameSite=Strict/i);
  assert.match(setCookie, /; Path=\/cms(?:;|$)/i);
  assert.match(setCookie, /; Max-Age=2592000(?:;|$)/i);
  assert.ok(!cookie.includes(credentials.password));
  assert.ok(!cookie.includes(credentials.email));

  const restored = await request("session", undefined, {
    cookie,
    authorized: false,
  });
  assert.deepEqual(restored.body, { authenticated: true });
  assert.equal((await request("tables", {}, { cookie })).status, 200);
  assert.equal(
    (await request("tables", credentials, { cookie: "" })).status,
    401,
  );
  assert.deepEqual((await request("session", undefined, { cookie: "" })).body, {
    authenticated: false,
  });
});

test("login matches an exact email address, preserving case-insensitive sign-in", async () => {
  assert.equal(
    (
      await request(
        "login",
        { ...credentials, email: " ADMIN@EXAMPLE.TEST " },
        { cookie: "" },
      )
    ).status,
    200,
  );
  for (const email of ["%", "_dmin@example.test", "admin%@example.test"]) {
    assert.equal(
      (await request("login", { ...credentials, email }, { cookie: "" }))
        .status,
      401,
    );
  }
  assert.equal(
    (await request("login", { email: [], password: "password" })).status,
    400,
  );
  assert.equal(
    (await request("login", credentials, { authorized: false })).status,
    401,
  );
});

test("login and logout reject other methods and cross-site requests cannot use a valid session", async () => {
  for (const name of ["login", "logout"]) {
    assert.equal((await request(name, undefined)).status, 405);
  }
  for (const headers of [
    { Origin: "https://another.example.test" },
    { "Sec-Fetch-Site": "cross-site" },
  ]) {
    assert.equal(
      (await request("login", credentials, { headers })).status,
      403,
    );
    assert.equal((await request("logout", {}, { headers })).status, 403);
    assert.equal((await request("config", {}, { headers })).status, 403);
    assert.equal(
      (await request("session", undefined, { headers })).status,
      403,
    );
  }
  assert.equal(
    (
      await request(
        "config",
        {},
        { headers: { Origin: "https://site.example.test" } },
      )
    ).status,
    200,
  );
});

test("forged and altered cookies cannot authenticate", async () => {
  const modified = `${adminCookie.slice(0, -1)}${adminCookie.endsWith("a") ? "b" : "a"}`;
  const forged = `framecore-cms-session=${encodeURIComponent(JSON.stringify({ userId: 1, expiresAt: Date.now() + 60000 }))}`;
  for (const cookie of [modified, forged]) {
    assert.equal((await request("config", {}, { cookie })).status, 401);
    assert.deepEqual((await request("session", undefined, { cookie })).body, {
      authenticated: false,
    });
  }
});

test("session expiry is checked by the server", async (context) => {
  const future = Date.now() + 31 * 24 * 60 * 60 * 1000;
  context.mock.method(Date, "now", () => future);
  assert.equal((await request("config", {})).status, 401);
  assert.deepEqual((await request("session")).body, { authenticated: false });
});

test("logout clears the browser session and removes the former password cookie", async () => {
  const oldCookie = `framecore-cms:login=${encodeURIComponent(JSON.stringify(credentials))}`;
  const response = await request(
    "logout",
    {},
    { cookie: `${adminCookie}; ${oldCookie}` },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { success: true });
  const cleared = response.cookies.find((value) =>
    value.startsWith("framecore-cms-session="),
  );
  assert.match(cleared, /; Max-Age=0(?:;|$)/i);
  assert.ok(
    response.cookies.some(
      (value) =>
        value.startsWith("framecore-cms:login=") &&
        /; Max-Age=0(?:;|$)/i.test(value),
    ),
  );
  assert.deepEqual(
    (await request("session", undefined, { cookie: sessionCookie(response) }))
      .body,
    { authenticated: false },
  );
});

test("password reset invalidates existing sessions immediately", async () => {
  const previous = sqlite
    .prepare("SELECT password, reset_id FROM admin_accounts WHERE id = 1")
    .get();
  const { createResetToken } =
    await import("../runtime/server/routes/utils/reset-token.js");
  const validation = createResetToken();
  sqlite
    .prepare("UPDATE admin_accounts SET reset_id = ? WHERE id = 1")
    .run(validation);
  try {
    assert.equal(
      (
        await request(
          "new-password",
          { validation, password: "updated-password" },
          { cookie: "" },
        )
      ).status,
      200,
    );
    assert.deepEqual((await request("session")).body, { authenticated: false });
    assert.equal((await request("config", {})).status, 401);
    assert.equal(
      (await request("login", credentials, { cookie: "" })).status,
      401,
    );
    assert.equal(
      (
        await request(
          "login",
          { ...credentials, password: "updated-password" },
          { cookie: "" },
        )
      ).status,
      200,
    );
  } finally {
    sqlite
      .prepare(
        "UPDATE admin_accounts SET password = ?, reset_id = ? WHERE id = 1",
      )
      .run(previous.password, previous.reset_id);
  }
});

test("deleting an account invalidates its existing session", async () => {
  const user = sqlite
    .prepare("SELECT * FROM admin_accounts WHERE id = 1")
    .get();
  sqlite.prepare("DELETE FROM admin_accounts WHERE id = 1").run();
  try {
    assert.equal((await request("config", {})).status, 401);
    assert.deepEqual((await request("session")).body, { authenticated: false });
  } finally {
    sqlite
      .prepare("INSERT INTO admin_accounts VALUES (?, ?, ?, ?)")
      .run(user.id, user.email, user.password, user.reset_id);
  }
});

test("session login requires a configured secret and local HTTP development remains possible", async () => {
  const previous = fixture.runtimeConfig.cmsSessionPassword;
  fixture.runtimeConfig.cmsSessionPassword = "too-short";
  try {
    assert.equal(
      (await request("login", credentials, { cookie: "" })).status,
      500,
    );
  } finally {
    fixture.runtimeConfig.cmsSessionPassword = previous;
  }
  const loggedIn = await request("login", credentials, {
    cookie: "",
    origin: "http://localhost:3000",
  });
  assert.equal(loggedIn.status, 200);
  const cookie = loggedIn.cookies.find((value) =>
    value.startsWith("framecore-cms-session="),
  );
  assert.match(cookie, /; HttpOnly/i);
  assert.ok(!/; Secure(?:;|$)/i.test(cookie));
});

test("Cloudflare runtime secrets work without a build-time secret and rotating them rejects old cookies", async () => {
  const previous = fixture.runtimeConfig.cmsSessionPassword;
  fixture.runtimeConfig.cmsSessionPassword = "";
  const env = {
    NUXT_CMS_SESSION_PASSWORD:
      "cloudflare-runtime-only-secret-32-characters-long",
  };
  try {
    const loggedIn = await request("login", credentials, { cookie: "", env });
    assert.equal(loggedIn.status, 200);
    assert.equal(loggedIn.cacheControl, "no-store");
    const cookie = sessionCookie(loggedIn);
    const restored = await request("session", undefined, { cookie, env });
    assert.deepEqual(restored.body, { authenticated: true });
    assert.equal(restored.cacheControl, "no-store");
    assert.deepEqual(
      (
        await request("session", undefined, {
          cookie,
          env: {
            NUXT_CMS_SESSION_PASSWORD:
              "a-different-cloudflare-runtime-secret-32-characters",
          },
        })
      ).body,
      { authenticated: false },
    );
  } finally {
    fixture.runtimeConfig.cmsSessionPassword = previous;
  }
});

test("Cloudflare HTTPS origin survives an internal HTTP adapter throughout the session flow", async () => {
  const origin = "http://localhost:3000";
  const externalOrigin = "https://site.example.test";
  const headers = { Origin: externalOrigin, "Sec-Fetch-Site": "same-origin" };
  const options = (name, cookie = "") => ({
    origin,
    cloudflareUrl: `${externalOrigin}/cms/${name}`,
    headers,
    cookie,
  });
  const loggedIn = await request("login", credentials, options("login"));
  assert.equal(loggedIn.status, 200);
  const cookie = sessionCookie(loggedIn);
  const setCookie = loggedIn.cookies.find((value) =>
    value.startsWith("framecore-cms-session="),
  );
  assert.match(setCookie, /; Secure(?:;|$)/i);
  assert.match(setCookie, /; HttpOnly(?:;|$)/i);
  assert.deepEqual(
    (await request("session", undefined, options("session", cookie))).body,
    { authenticated: true },
  );
  const config = await request("config", {}, options("config", cookie));
  assert.equal(config.status, 200);
  assert.deepEqual(config.body.graphConfig, fixture.graphConfig);
  const logout = await request("logout", {}, options("logout", cookie));
  assert.equal(logout.status, 200);
  assert.match(
    logout.cookies.find((value) => value.startsWith("framecore-cms-session=")),
    /; Max-Age=0(?:;|$)/i,
  );
  assert.deepEqual(
    (
      await request(
        "session",
        undefined,
        options("session", sessionCookie(logout)),
      )
    ).body,
    { authenticated: false },
  );
});

test("Cloudflare trusted origin rejects spoofed forwarding headers and other browser origins", async () => {
  const origin = "http://localhost:3000";
  const externalOrigin = "https://site.example.test";
  for (const headers of [
    {
      Origin: "https://attacker.example",
      "X-Forwarded-Host": "attacker.example",
      "X-Forwarded-Proto": "https",
    },
    { Origin: "http://site.example.test", "X-Forwarded-Proto": "http" },
    { Origin: "https://sub.site.example.test", "Sec-Fetch-Site": "same-site" },
    { Origin: "https://site.example.test:444" },
    { Origin: "null" },
    { Origin: "https://site.example.test/path" },
    { Origin: externalOrigin, "Sec-Fetch-Site": "cross-site" },
  ]) {
    for (const [name, body] of [
      ["login", credentials],
      ["config", {}],
      ["session", undefined],
      ["logout", {}],
    ]) {
      const response = await request(name, body, {
        origin,
        cloudflareUrl: `${externalOrigin}/cms/${name}`,
        headers,
      });
      assert.equal(
        response.status,
        403,
        `${name} must reject ${JSON.stringify(headers)}`,
      );
    }
  }
  // Untrusted forwarding headers neither replace nor invalidate the original URL.
  const valid = await request(
    "config",
    {},
    {
      origin,
      cloudflareUrl: `${externalOrigin}/cms/config`,
      headers: {
        Origin: externalOrigin,
        "X-Forwarded-Host": "attacker.example",
        "X-Forwarded-Proto": "http",
      },
    },
  );
  assert.equal(valid.status, 200);
});

test("without a Cloudflare request the real request URL remains authoritative", async () => {
  for (const headers of [
    {
      Origin: "https://attacker.example",
      "X-Forwarded-Host": "attacker.example",
      "X-Forwarded-Proto": "https",
    },
    { Origin: "http://site.example.test", "X-Forwarded-Proto": "http" },
  ]) {
    assert.equal(
      (await request("login", credentials, { headers })).status,
      403,
    );
  }
  const origin = "http://localhost:3000";
  const loggedIn = await request("login", credentials, {
    origin,
    cookie: "",
    headers: { Origin: origin },
  });
  assert.equal(loggedIn.status, 200);
  assert.ok(
    !/; Secure(?:;|$)/i.test(
      loggedIn.cookies.find((value) =>
        value.startsWith("framecore-cms-session="),
      ),
    ),
  );
  assert.equal(
    (
      await request("login", credentials, {
        origin,
        cookie: "",
        headers: { Origin: "http://localhost:3001" },
      })
    ).status,
    403,
  );
});
