import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { registerHooks } from "node:module";
import { after, before, beforeEach, test } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { compile, createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";
import { compileScript, compileTemplate, parse } from "vue/compiler-sfc";
import { requiredFields } from "../runtime/utils/requiredFields.js";
import { formatFieldValue } from "../runtime/utils/fieldFormatting.js";

const fixtureKey = Symbol.for("framecore-cms.frontend-test");
const fixture = {};
globalThis[fixtureKey] = fixture;
const fixtureSource = `const fixture = globalThis[Symbol.for("framecore-cms.frontend-test")];`;
const sources = {
  "#imports": `${fixtureSource}
    export const useRuntimeConfig = () => fixture.runtimeConfig;`,
  "#framecore-cms/image": `${fixtureSource}
    export const useCmsImage = () => fixture.previewImage;`,
  ofetch: `${fixtureSource}
    export const $fetch = async (url, options) => {
      fixture.requests.push({ url, options });
      return fixture.respond(url, options);
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

let useCmsStore;
let useLoginStore;
const originalLocation = Object.getOwnPropertyDescriptor(
  globalThis,
  "location",
);

before(async () => {
  ({ useCmsStore } = await import("../runtime/components/stores/cmsStore.js"));
  ({ useLoginStore } =
    await import("../runtime/components/stores/loginStore.js"));
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: { reload: () => fixture.reloads++ },
  });
});

beforeEach(() => {
  const pinia = createPinia();
  setActivePinia(pinia);
  Object.assign(fixture, {
    pinia,
    runtimeConfig: {
      public: {
        userName: "site",
        userPass: "public-key",
        imageBaseUrl: "https://files.example.test/",
      },
    },
    requests: [],
    reloads: 0,
    previewImage: null,
    tables: [{ id: "products", name: "Products", viewMode: "list" }],
    fields: [],
    rows: [],
    metadata: {
      graphConfig: { products: [{ type: "bar", labelField: "name" }] },
      staticContentTypes: {
        Home: { header: { copy: { text: "textarea", image: "fileImg" } } },
      },
    },
    respond(url) {
      if (url === "/cms/config") return structuredClone(this.metadata);
      if (url === "/cms/tables") return structuredClone(this.tables);
      if (url === "/cms/fields") return structuredClone(this.fields);
      if (url === "/cms/rows") return structuredClone(this.rows);
      throw new Error(`Unexpected request: ${url}`);
    },
  });
  useLoginStore().$patch({ isLoggedIn: true, initialized: true });
});

after(() => {
  hooks.deregister();
  if (originalLocation) {
    Object.defineProperty(globalThis, "location", originalLocation);
  } else {
    delete globalThis.location;
  }
  delete globalThis[fixtureKey];
});

// Evaluate the real Options API methods without mounting a browser or importing
// the component's render-only children from its separate <script setup> block.
async function componentOptions(name) {
  const url = new URL(`../runtime/components/${name}.vue`, import.meta.url);
  const { descriptor, errors } = parse(await readFile(url, "utf8"), {
    filename: url.pathname,
  });
  assert.deepEqual(errors, []);
  const source = descriptor.script.content.replace(
    /from (["'])(\.[^"']+)\1/g,
    (_, quote, specifier) => `from ${quote}${new URL(specifier, url)}${quote}`,
  );
  return (await import(`data:text/javascript,${encodeURIComponent(source)}`))
    .default;
}

function bindMethods(options, properties) {
  const instance = { ...properties };
  for (const [name, method] of Object.entries(options.methods)) {
    instance[name] = method.bind(instance);
  }
  return instance;
}

async function loadSalesStatistics() {
  fixture.tables = [{ id: "sales", name: "Sales", viewMode: "graph" }];
  fixture.metadata.graphConfig = {
    sales: [{ type: "selectors", dateField: "soldAt" }],
  };
  fixture.fields = [
    { name: "id", type: "integer", hidden: true },
    { name: "product", type: "text", label: "Produkt" },
    { name: "amount", type: "integer", label: "Belopp" },
    { name: "paid", type: "checkbox", label: "Betald" },
    { name: "soldAt", type: "date", label: "Såld" },
    { name: "period", type: "dateRange", label: "Period" },
    { name: "details", type: "json", label: "Detaljer" },
    { name: "orderStatus", type: "text" },
    { name: "internalNote", type: "text", label: "Hemligt", hidden: true },
  ];
  fixture.rows = [
    {
      id: 1,
      product: 'Widget, "A"\nNew',
      amount: 0,
      paid: false,
      soldAt: "2026-01-12",
      period: ["2026-01-12", "2026-01-14"],
      details: { channel: "web" },
      orderStatus: "pending",
      internalNote: "Do not display or export",
    },
    { id: 2, product: "Other month", amount: 42, soldAt: "2026-02-01" },
  ];
  const store = useCmsStore();
  await store.loadTables();
  store.tableId = "sales";
  store.viewMode = "graph";
  await store.loadFields();
  await store.loadRows("asc", "soldAt");
  store.selectedYear = "2026";
  store.selectedMonth = "January";
  return store;
}

test("all runtime Vue files compile with their CMS components explicitly imported", async () => {
  const directory = new URL("../runtime/components/", import.meta.url);
  const files = (await readdir(directory, { recursive: true })).filter((file) =>
    file.endsWith(".vue"),
  );
  files.push("../pages/admin.vue");

  for (const file of files) {
    const url = new URL(file, directory);
    const { descriptor, errors } = parse(await readFile(url, "utf8"), {
      filename: url.pathname,
    });
    assert.deepEqual(errors, [], file);
    const script =
      descriptor.script || descriptor.scriptSetup
        ? compileScript(descriptor, { id: file })
        : undefined;
    const result = compileTemplate({
      source: descriptor.template.content,
      filename: url.pathname,
      id: file,
      compilerOptions: { bindingMetadata: script?.bindings },
    });
    assert.deepEqual(result.errors, [], file);
    assert.doesNotMatch(result.code, /resolveComponent\("Cms/, file);
  }
});

test("CMS metadata loads once using cookies without sending admin credentials", async () => {
  const store = useCmsStore();
  assert.equal(store.$id, "framecore-cms:content");
  assert.equal(useLoginStore().$id, "framecore-cms:login");

  await store.loadTables();
  await store.loadTables();

  assert.deepEqual(
    fixture.requests.map((request) => request.url),
    ["/cms/config", "/cms/tables", "/cms/tables"],
  );
  for (const { options } of fixture.requests) {
    assert.equal(options.method, "POST");
    assert.equal(
      options.headers.Authorization,
      `Basic ${btoa("site:public-key")}`,
    );
    assert.deepEqual(options.body, {});
    assert.equal(options.credentials, "same-origin");
  }
  assert.deepEqual(store.graphConfig, fixture.metadata.graphConfig);
  assert.deepEqual(
    store.staticContentTypes,
    fixture.metadata.staticContentTypes,
  );
  assert.deepEqual(store.tables, fixture.tables);
  assert.equal(store.loadingFlag, false);
});

test("statistics tables only appear when the site opts in with graph configuration", async () => {
  const articles = { id: "articles", name: "Articles", viewMode: "list" };
  const sales = { id: "sales", name: "Sales", viewMode: "graph" };
  const archive = { id: "archive", name: "Archive", viewMode: "graph" };
  fixture.tables = [articles, sales, archive];
  fixture.metadata.graphConfig = {};
  const store = useCmsStore();
  await store.loadTables();
  assert.deepEqual(store.tables, [articles]);

  store.$reset();
  fixture.metadata.graphConfig = {
    sales: [{ type: "selectors" }],
    archive: [],
  };
  await store.loadTables();
  assert.deepEqual(store.tables, [articles, sales]);

  store.$reset();
  fixture.tables = [articles];
  await store.loadTables();
  assert.deepEqual(store.tables, [articles]);
});

test("statistics CSV uses site fields and labels, excludes hidden fields and preserves values", async (t) => {
  const store = await loadSalesStatistics();
  const options = await componentOptions("GraphSelectors");
  const instance = bindMethods(options, {
    cmsStore: store,
    dateField: store.graphDateField,
  });
  let exportedBlob;
  t.mock.method(URL, "createObjectURL", (blob) => {
    exportedBlob = blob;
    return "blob:test-export";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  let clicked = false;
  const link = { click: () => (clicked = true) };
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: () => link };
  try {
    instance.exportCsv();
    assert.equal(
      await exportedBlob.text(),
      "Produkt,Belopp,Betald,Såld,Period,Detaljer,Order Status\n" +
        '"Widget, ""A""\nNew",0,false,12 January 2026,12 January 2026 – 14 January 2026,"{""channel"":""web""}",pending',
    );
    assert.deepEqual(
      [...new Uint8Array(await exportedBlob.arrayBuffer()).slice(0, 3)],
      [0xef, 0xbb, 0xbf],
    );
    assert.equal(link.download, "sales-2026-january.csv");
    assert.equal(clicked, true);
    assert.equal(URL.revokeObjectURL.mock.calls[0].arguments[0], link.href);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test("statistics list renders site fields with the same formatting and keeps pagination", async () => {
  const store = await loadSalesStatistics();
  const options = await componentOptions("GraphList");
  const url = new URL("../runtime/components/GraphList.vue", import.meta.url);
  const { descriptor } = parse(await readFile(url, "utf8"));
  const app = createSSRApp(
    { ...options, render: compile(descriptor.template.content) },
    { dateField: store.graphDateField },
  );
  app.use(fixture.pinia);
  const html = await renderToString(app);
  for (const value of [
    "Produkt",
    "Belopp",
    "Betald",
    "Order Status",
    "pending",
  ]) {
    assert(html.includes(value), value);
  }
  assert.match(html, />0<\/span>/);
  assert.match(html, />false<\/span>/);
  assert(html.includes("12 January 2026 – 14 January 2026"));
  assert(html.includes("{&quot;channel&quot;:&quot;web&quot;}"));
  for (const value of [
    "Hemligt",
    "Do not display or export",
    "Venue:",
    "Other month",
  ]) {
    assert(!html.includes(value), value);
  }

  store.items = Array.from({ length: 55 }, (_, index) => ({
    id: index,
    product: `Product ${index}`,
    soldAt: "2026-01-12",
  }));
  const instance = bindMethods(options, {
    items: store.filteredSelectItems(store.graphDateField),
    currentPage: 1,
    totalPages: 2,
  });
  assert.equal(options.computed.totalPages.call(instance), 2);
  assert.equal(options.computed.pagedItems.call(instance).length, 50);
  instance.goToPage(2);
  assert.equal(options.computed.pagedItems.call(instance).length, 5);
});

test("switching statistics tables resets period filters and sorts by the configured date field", async () => {
  const store = await loadSalesStatistics();
  const options = await componentOptions("TableList");
  const instance = bindMethods(options, { cmsStore: store, tableIndex: 0 });
  store.sortOrder = "desc";
  await instance.loadSchema();
  assert.equal(store.selectedYear, "-");
  assert.equal(store.selectedMonth, "-");
  assert.equal(store.sortField, "soldAt");
  assert.equal(store.sortOrder, "asc");
  assert.equal(store.items.length, 2);
  const rowsRequest = fixture.requests.findLast(
    ({ url }) => url === "/cms/rows",
  );
  assert.equal(rowsRequest.options.body.field_name, "soldAt");

  fixture.tables = [
    { id: "statistics", name: "Statistics", viewMode: "graph" },
  ];
  fixture.metadata.graphConfig = {
    statistics: [{ type: "selectors", dateField: "date" }],
  };
  fixture.fields = [
    { name: "title", type: "text", label: "Title" },
    { name: "venue", type: "text", label: "Venue" },
    { name: "date", type: "dateRange", label: "Date" },
  ];
  store.configLoaded = false;
  await store.loadTables();
  await instance.loadSchema();
  assert.equal(store.graphDateField, "date");
  assert.equal(store.sortField, "date");
  assert.deepEqual(
    store.visibleFields.map(({ name }) => name),
    ["title", "venue", "date"],
  );
});

test("shared statistics formatting retains date ranges and handles empty or structured values", () => {
  for (const [value, type, expected] of [
    [null, "text", ""],
    ["invalid", "date", ""],
    [["2026-01-12", "2026-01-12"], "dateRange", "12 January 2026"],
    [["2026-01-12", null], "dateRange", "12 January 2026"],
    [[null, "2026-01-12"], "dateRange", ""],
    [0, "integer", "0"],
    [false, "checkbox", "false"],
    [["one", "two"], "json", '["one","two"]'],
  ]) {
    assert.equal(formatFieldValue(value, type), expected);
  }
});

test("failed metadata loading clears the loading state and can be retried", async (t) => {
  t.mock.method(console, "log", () => {});
  const respond = fixture.respond;
  fixture.respond = () => {
    throw new Error("Temporary network failure");
  };
  const store = useCmsStore();
  await store.loadTables();
  assert.equal(store.loadingFlag, false);
  assert.equal(store.configLoaded, false);
  assert.match(store.errorMessage, /try again/i);
  assert.equal(useLoginStore().isValid, true);

  fixture.respond = respond;
  await store.loadTables();
  assert.equal(store.configLoaded, true);
  assert.deepEqual(store.tables, fixture.tables);
  assert.equal(store.loadingFlag, false);
});

test("the loading indicator stays active while metadata is pending", async () => {
  let resolveMetadata;
  fixture.respond = (url) =>
    url === "/cms/config"
      ? new Promise((resolve) => {
          resolveMetadata = resolve;
        })
      : structuredClone(fixture.tables);
  const store = useCmsStore();
  const pending = store.loadTables();
  assert.equal(store.loadingFlag, true);
  resolveMetadata(structuredClone(fixture.metadata));
  await pending;
  assert.equal(store.loadingFlag, false);
});

test("an expired server session returns to login and explains why", async (t) => {
  t.mock.method(console, "log", () => {});
  fixture.respond = () => {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  };
  const store = useCmsStore();
  await store.loadTables();
  assert.equal(useLoginStore().isValid, false);
  assert.equal(useLoginStore().email, undefined);
  assert.equal(useLoginStore().password, undefined);
  assert.match(useLoginStore().errorMessage, /session has expired/i);
  assert.equal(fixture.reloads, 0);
  assert.equal(store.loadingFlag, false);
});

test("required CMS fields reject empty values without rejecting zero or hidden fields", () => {
  const store = useCmsStore();
  const cases = [
    { type: "text", value: undefined, valid: false },
    { type: "text", value: null, valid: false },
    { type: "text", value: "   ", valid: false },
    { type: "text", value: "Title", valid: true },
    { type: "number", value: 0, valid: true },
    { type: "checkbox", value: false, valid: false },
    { type: "checkbox", value: true, valid: true },
    { type: "file", value: [], valid: false },
    { type: "file", value: [{ name: "hero.png" }], valid: true },
    { type: "file", value: {}, valid: false },
    { type: "file", value: { name: "hero.png" }, valid: true },
  ];
  for (const { type, value, valid } of cases) {
    store.schema = [{ name: "field", type, required: true }];
    assert.equal(
      store.validateFields({ field: value }),
      valid,
      `${type}: ${JSON.stringify(value)}`,
    );
  }
  store.schema = [
    { name: "id", type: "text", required: true, hidden: true },
    { name: "subtitle", type: "text", required: false },
  ];
  assert.equal(store.validateFields({}), true);
});

test("login form validation keeps required text, checkbox and radio group behavior", () => {
  const input = { type: "text", required: true, value: "" };
  const checkbox = {
    type: "checkbox",
    required: true,
    value: "on",
    checked: false,
  };
  const radios = [false, false].map((checked) => ({
    type: "radio",
    required: true,
    value: "choice",
    checked,
    dataset: { name: "group" },
  }));
  const form = {
    querySelectorAll: (selector) =>
      selector === "input" ? [input, checkbox, ...radios] : [],
  };
  assert.equal(requiredFields(form), false);
  input.value = "Title";
  checkbox.checked = true;
  assert.equal(requiredFields(form), false);
  radios[1].checked = true;
  assert.equal(requiredFields(form), true);
});

test("nested JSON fields use the metadata loaded for the current site", async () => {
  const store = useCmsStore();
  await store.loadTables();
  const options = await componentOptions("JsonFields");
  const instance = bindMethods(options, {
    item: { title: "Home" },
    itemData: {},
    path: "header",
    baseInput: { name: "content", type: "json", required: true },
  });
  assert.deepEqual(instance.getOrCreateNestedSection("copy"), {
    text: "",
    image: "",
  });
  instance.itemData.copy.text = "Keep edited text";
  assert.equal(
    instance.getOrCreateNestedSection("copy").text,
    "Keep edited text",
  );

  store.staticContentTypes = {
    Home: { header: { copy: { description: "textarea" } } },
  };
  assert.deepEqual(instance.getTemplateForPath("copy"), {
    description: "textarea",
  });
  instance.path = "header.copy";
  assert.deepEqual(instance.buildInputConfig("description", "textarea"), {
    name: "description",
    type: "textarea",
    required: true,
    uniqueId: "header.copy.description",
    label: "header.copy.description",
  });
});

test("image previews use the configured file origin without needing Nuxt Image", async () => {
  const options = await componentOptions("Inputs");
  const instance = bindMethods(options, options.data());
  assert.equal(
    instance.fileUrl("hero.png"),
    "https://files.example.test/cms-files/hero.png",
  );
  instance.imageBaseUrl = "";
  assert.equal(instance.fileUrl("hero.png"), "/cms-files/hero.png");
});

test("stored image previews use the host image optimizer without changing file data", async () => {
  const requests = [];
  fixture.previewImage = (url, modifiers) => {
    requests.push({ url, modifiers });
    return "https://images.example.test/hero-80.webp";
  };
  const options = await componentOptions("Inputs");
  const item = { photo: "hero.png" };
  const instance = bindMethods(options, { ...options.data(), item });
  assert.equal(
    instance.fileUrl(item.photo),
    "https://images.example.test/hero-80.webp",
  );
  assert.deepEqual(requests, [
    {
      url: "https://files.example.test/cms-files/hero.png",
      modifiers: { width: 80, format: "webp" },
    },
  ]);
  assert.deepEqual(item, { photo: "hero.png" });
});

test("stored image previews render lazily with stable dimensions", async () => {
  const options = await componentOptions("Inputs");
  const url = new URL("../runtime/components/Inputs.vue", import.meta.url);
  const { descriptor } = parse(await readFile(url, "utf8"));
  const app = createSSRApp(
    {
      ...options,
      components: {
        VueDatePicker: { render: () => null },
        IconCloseCircleOutline: { render: () => null },
      },
      render: compile(descriptor.template.content),
    },
    {
      input: { name: "photo", type: "fileImg" },
      item: { photo: "hero.png" },
      index: 0,
    },
  );
  const html = await renderToString(app);
  assert.match(
    html,
    /<img[^>]*src="https:\/\/files\.example\.test\/cms-files\/hero\.png"/,
  );
  assert.match(html, /<img[^>]*width="80"[^>]*height="80"[^>]*loading="lazy"/);
});

test("the home control returns to the current site's origin including its port", async () => {
  const originalWindow = globalThis.window;
  globalThis.window = {
    location: { origin: "https://site.example.test:4317", href: "" },
  };
  try {
    const options = await componentOptions("Navbar");
    options.methods.backHomepage();
    assert.equal(
      globalThis.window.location.href,
      "https://site.example.test:4317",
    );
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test("login keeps credentials out of state and restores the server session on reload", async () => {
  const store = useLoginStore();
  store.clear();
  fixture.respond = (url) => {
    if (url === "/cms/login" || url === "/cms/logout") return { success: true };
    if (url === "/cms/session") return { authenticated: true };
    throw new Error(`Unexpected request: ${url}`);
  };
  await store.login("admin@example.test", "secret");
  assert.deepEqual(fixture.requests[0].options.body, {
    email: "admin@example.test",
    password: "secret",
  });
  assert.equal(store.isValid, true);
  assert.equal(JSON.stringify(store.$state).includes("secret"), false);
  assert.equal("password" in store.$state, false);
  store.clear();
  await store.restore();
  assert.equal(store.initialized, true);
  assert.equal(store.isValid, true);
  await store.logout();
  assert.equal(store.isValid, false);
  assert.deepEqual(
    fixture.requests.map(({ url }) => url),
    ["/cms/login", "/cms/session", "/cms/logout"],
  );
});

test("failed logout does not claim the server session ended", async () => {
  fixture.respond = () => {
    throw new Error("Network unavailable");
  };
  await assert.rejects(useLoginStore().logout(), /Network unavailable/);
  assert.equal(useLoginStore().isValid, true);
});

test("failed writes preserve edits and show an error while clearing busy flags", async () => {
  const store = useCmsStore();
  store.tableId = "products";
  store.items = [{ id: 1, title: "Unsaved" }];
  store.showItem = 0;
  store.itemOpen = true;
  store.editingItem = true;
  fixture.respond = () => {
    throw Object.assign(new Error("Internal details"), {
      status: 500,
      data: { message: "SQL secret details" },
    });
  };
  assert.equal(await store.saveItem(0), false);
  assert.equal(store.items[0].title, "Unsaved");
  assert.equal(store.itemOpen, true);
  assert.equal(store.editingItem, true);
  assert.equal(store.saveFlag, false);
  assert.match(store.errorMessage, /try again/i);
  assert.doesNotMatch(store.errorMessage, /SQL/);
  assert.equal(await store.archiveItems("archive"), false);
  assert.equal(store.loadingFlag, false);
  assert.equal(
    fixture.requests.some(({ url }) => url === "/cms/delete-items"),
    false,
  );
});
