import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { DatabaseSync } from "node:sqlite";
import { after, before, beforeEach, test } from "node:test";
import { H3 } from "h3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { parse } from "vue/compiler-sfc";

const fixtureKey = Symbol.for("framecore-cms.archive-test");
const fixture = {
  authenticated: true,
  schema: {
    bookings: sqliteTable("site_bookings", {
      id: integer("booking_id").primaryKey({ autoIncrement: true }),
      title: text("title"),
      date: text("date_range", { mode: "json" }),
      sortOrder: integer("sort_order"),
    }),
    archive: sqliteTable("site_archive", {
      id: integer("archive_id").primaryKey({ autoIncrement: true }),
      title: text("archived_title"),
      date: text("archived_date", { mode: "json" }),
      sortOrder: integer("sort_order"),
      archivedAt: text("archived_at").default("from-db-default"),
    }),
  },
  cmsTables: [{ id: "bookings" }, { id: "archive", backupRef: "bookings" }],
  runtimeConfig: { userName: "site", userPass: "public-key" },
  batchCalls: 0,
  beforeBatch: null,
};
globalThis[fixtureKey] = fixture;
const fixtureSource = `const fixture = globalThis[Symbol.for("framecore-cms.archive-test")];`;
const sources = {
  "#framecore-cms/config": `${fixtureSource}
    export const { schema, cmsTables } = fixture;`,
  "nuxt/internal/server-runtime-config": `${fixtureSource}
    export const useRuntimeConfig = () => fixture.runtimeConfig;`,
};
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    let source = sources[specifier];
    if (
      specifier === "./utils/check-authentication.js" &&
      context.parentURL?.endsWith("/runtime/server/routes/archive-items.js")
    ) {
      source = `${fixtureSource}
        export const checkAuthentication = async () => fixture.authenticated;`;
    }
    if (source) {
      return {
        url: `data:text/javascript,${encodeURIComponent(source)}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const sqlite = new DatabaseSync(":memory:");
const d1 = {
  prepare(query) {
    const statement = sqlite.prepare(query);
    let values = [];
    return {
      bind(...parameters) {
        assert.ok(parameters.length <= 100, "D1 parameter limit exceeded");
        values = parameters;
        return this;
      },
      async raw() {
        return statement.all(...values).map((row) => Object.values(row));
      },
      all() {
        return { results: statement.all(...values), success: true };
      },
      run() {
        statement.run(...values);
        return { success: true };
      },
    };
  },
  async batch(statements) {
    fixture.batchCalls++;
    await fixture.beforeBatch?.();
    // Match D1's atomic, sequential batch semantics with real SQLite rollback.
    sqlite.exec("BEGIN");
    try {
      const results = statements.map((statement) => statement.all());
      sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  },
};

let handler;
before(async () => {
  sqlite.exec(`
    CREATE TABLE site_bookings (
      booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT, date_range TEXT, sort_order INTEGER
    );
    CREATE TABLE site_archive (
      archive_id INTEGER PRIMARY KEY AUTOINCREMENT,
      archived_title TEXT CHECK(archived_title != 'invalid'),
      archived_date TEXT, sort_order INTEGER,
      archived_at TEXT DEFAULT 'from-db-default'
    );
  `);
  handler = (await import("../runtime/server/routes/archive-items.js")).default;
});
beforeEach(() => {
  sqlite.exec("DELETE FROM site_bookings; DELETE FROM site_archive;");
  fixture.authenticated = true;
  fixture.batchCalls = 0;
  fixture.beforeBatch = null;
});
after(() => {
  hooks.deregister();
  sqlite.close();
  delete globalThis[fixtureKey];
});

const expiredDate = ["2020-01-01T00:00:00.000Z", "2020-01-02T00:00:00.000Z"];
const futureDate = ["2999-01-01T00:00:00.000Z", "2999-01-02T00:00:00.000Z"];
function addBooking(id, title, date = expiredDate) {
  sqlite
    .prepare("INSERT INTO site_bookings VALUES (?, ?, ?, ?)")
    .run(id, title, JSON.stringify(date), id);
}
function rows(table) {
  return sqlite.prepare(`SELECT * FROM ${table}`).all();
}
async function request(body = { table_id: "archive" }, basicAuth = true) {
  const app = new H3({ silent: true });
  app.all("/**", (event) => {
    event.context.cloudflare = { env: { DB: d1 } };
    return handler(event);
  });
  const response = await app.fetch(
    new Request("https://site.example.test/cms/archive-items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(basicAuth
          ? { Authorization: `Basic ${btoa("site:public-key")}` }
          : {}),
      },
      body: JSON.stringify(body),
    }),
  );
  return { status: response.status, body: await response.json() };
}

test("archiving moves only expired date ranges and preserves host mappings and defaults", async () => {
  addBooking(100, "Expired");
  addBooking(101, "Future", futureDate);
  addBooking(102, "Missing date", null);
  addBooking(103, "Invalid date", ["invalid", "invalid"]);
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { success: true });
  const archived = rows("site_archive");
  assert.equal(archived.length, 1);
  assert.notEqual(archived[0].archive_id, 100);
  assert.equal(archived[0].archived_title, "Expired");
  assert.deepEqual(JSON.parse(archived[0].archived_date), expiredDate);
  assert.equal(archived[0].archived_at, "from-db-default");
  assert.equal(rows("site_bookings").length, 3);
  assert.equal(fixture.batchCalls, 1);
  await request();
  assert.equal(
    rows("site_archive").length,
    1,
    "retries must not duplicate rows",
  );
});

test("archive insertion failure rolls back every chunk and keeps all source rows", async (context) => {
  context.mock.method(console, "error", () => {});
  for (let index = 0; index < 105; index++) {
    addBooking(index + 1, index === 60 ? "invalid" : `Expired ${index}`);
  }
  const response = await request();
  assert.equal(response.status, 500);
  assert.equal(fixture.batchCalls, 1);
  assert.equal(rows("site_archive").length, 0);
  assert.equal(rows("site_bookings").length, 105);
});

test("archiving preserves date ranges stored with JSON whitespace", async () => {
  addBooking(1, "Pretty JSON");
  const prettyDate = JSON.stringify(expiredDate, null, 2);
  sqlite
    .prepare("UPDATE site_bookings SET date_range = ? WHERE booking_id = 1")
    .run(prettyDate);
  assert.equal((await request()).status, 200);
  assert.equal(rows("site_bookings").length, 0);
  const archived = rows("site_archive");
  assert.equal(archived.length, 1);
  assert.equal(archived[0].archived_date, prettyDate);
});

test("source deletion failure rolls back the inserted archive copy", async (context) => {
  context.mock.method(console, "error", () => {});
  addBooking(1, "Expired");
  sqlite.exec(`CREATE TRIGGER reject_archive_delete BEFORE DELETE ON site_bookings
    BEGIN SELECT RAISE(ABORT, 'delete failed'); END;`);
  try {
    assert.equal((await request()).status, 500);
    assert.equal(rows("site_archive").length, 0);
    assert.equal(rows("site_bookings").length, 1);
  } finally {
    sqlite.exec("DROP TRIGGER reject_archive_delete");
  }
});

test("successful archive batches span all chunks within D1's parameter limit", async () => {
  for (let index = 0; index < 105; index++)
    addBooking(index + 1, `Old ${index}`);
  assert.equal((await request()).status, 200);
  assert.equal(fixture.batchCalls, 1);
  assert.equal(rows("site_bookings").length, 0);
  assert.equal(rows("site_archive").length, 105);
});

test("concurrent archive requests cannot create duplicate copies", async () => {
  addBooking(1, "Expired");
  let release;
  const ready = new Promise((resolve) => (release = resolve));
  fixture.beforeBatch = async () => {
    if (fixture.batchCalls === 2) release();
    await ready;
  };
  const responses = await Promise.all([request(), request()]);
  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200],
  );
  assert.equal(rows("site_archive").length, 1);
  assert.equal(rows("site_bookings").length, 0);
});

test("a booking rescheduled before the transaction stays in its source table", async () => {
  addBooking(1, "Rescheduled");
  fixture.beforeBatch = () => {
    sqlite
      .prepare("UPDATE site_bookings SET date_range = ? WHERE booking_id = 1")
      .run(JSON.stringify(futureDate));
  };
  assert.equal((await request()).status, 200);
  assert.equal(rows("site_bookings").length, 1);
  assert.equal(rows("site_archive").length, 0);
});

test("archive requires authentication and an allowlisted archive target", async () => {
  addBooking(1, "Expired");
  assert.equal((await request({ table_id: "archive" }, false)).status, 401);
  fixture.authenticated = false;
  assert.equal((await request()).status, 401);
  fixture.authenticated = true;
  assert.equal((await request({ table_id: "bookings" })).status, 400);
  assert.equal((await request({ table_id: "unknown" })).status, 400);
  assert.equal(rows("site_bookings").length, 1);
  assert.equal(fixture.batchCalls, 0);
});

test("table selection stops on archive failure and loads archived rows only after success", async () => {
  const { descriptor } = parse(
    await readFile(
      new URL("../runtime/components/TableList.vue", import.meta.url),
      "utf8",
    ),
  );
  const script = descriptor.script.content.replace(
    /import \{ useCmsStore \} from "\.\/stores\/cmsStore\.js";/,
    "",
  );
  const options = (
    await import(`data:text/javascript,${encodeURIComponent(script)}`)
  ).default;
  const calls = [];
  let succeeds = false;
  const store = {
    tables: [{ id: "archive", viewMode: "graph", backupRef: "bookings" }],
    allDateFields: [{ name: "date" }],
    graphDateField: "date",
    async loadFields() {
      calls.push("fields");
      return true;
    },
    async archiveItems(tableId) {
      assert.equal(tableId, "archive");
      calls.push("archive");
      return succeeds;
    },
    async loadRows() {
      calls.push("rows");
    },
  };
  const instance = { cmsStore: store, tableIndex: 0 };
  await options.methods.loadSchema.call(instance);
  assert.deepEqual(calls, ["fields", "archive"]);
  assert.equal(store.tableId, "archive");
  assert.equal(store.loadingFlag, false);
  succeeds = true;
  calls.length = 0;
  await options.methods.loadSchema.call(instance);
  assert.deepEqual(calls, ["fields", "archive", "rows"]);
});
