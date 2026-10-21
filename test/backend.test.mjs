import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { createApp, defineEventHandler, toWebHandler } from "h3";
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
  "nitropack/runtime": `${fixtureSource}
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
  ]) {
    routes[name] = (
      await import(`../runtime/server/routes/${name}.js`)
    ).default;
  }
});

after(() => {
  hooks.deregister();
  sqlite.close();
  delete globalThis[fixtureKey];
});

async function request(name, body, authorized = true) {
  const app = createApp({ onError: () => {} });
  app.use(
    defineEventHandler(async (event) => {
      event.context.cloudflare = { env: { DB: d1, FILES: bucket } };
      return routes[name](event);
    }),
  );
  const response = await toWebHandler(app)(
    new Request(`https://site.example.test/cms/${name}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(authorized
          ? { Authorization: `Basic ${btoa("public-site:public-key")}` }
          : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  return { status: response.status, body: await response.json() };
}

test("metadata uses host configuration and still requires admin authentication", async () => {
  const tables = await request("tables", credentials);
  assert.equal(tables.status, 200);
  assert.deepEqual(tables.body, fixture.cmsTables);

  const config = await request("config", credentials);
  assert.equal(config.status, 200);
  assert.deepEqual(config.body, {
    graphConfig: fixture.graphConfig,
    staticContentTypes: fixture.staticContentTypes,
  });
  assert.equal(
    (await request("config", { ...credentials, password: "wrong" })).status,
    401,
  );
  assert.equal((await request("config", credentials, false)).status, 401);
});

test("CRUD and sorting work with a host table outside the original site schema", async () => {
  const fields = await request("fields", {
    ...credentials,
    table_id: "products",
  });
  assert.equal(fields.status, 200);
  assert.deepEqual(
    fields.body.map((field) => field.name),
    ["id", "name", "sortOrder"],
  );
  assert.equal(fields.body[1].label, "Product");

  const rows = await request("rows", { ...credentials, table_id: "products" });
  assert.equal(rows.status, 200);
  assert.deepEqual(
    rows.body.map((row) => row.name),
    ["First", "Second"],
  );

  const base = { ...credentials, table_id: "products", schema: [] };
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
  assert.equal(
    (await request("rows", { ...credentials, table_id: "users" })).status,
    400,
  );
});

test("public static content and login retain their existing API contracts", async () => {
  const content = await request("static");
  assert.equal(content.status, 200);
  assert.deepEqual(content.body[0].content, { title: "Welcome" });
  assert.equal((await request("static", undefined, false)).status, 401);
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
  const source = { ...credentials, table_id: archive.backupRef };
  assert.equal((await request("add-items", { ...source, items })).status, 200);
  const sourceRows = (await request("rows", source)).body;
  const expired = sourceRows.filter((row) => row.name.startsWith("Expired"));
  assert.equal(expired.length, 12);
  // Bulk inserts deliberately discard IDs from the source table.
  assert.ok(expired.every((row) => row.id < 100));

  const target = { ...credentials, table_id: archive.id };
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
    ...credentials,
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
