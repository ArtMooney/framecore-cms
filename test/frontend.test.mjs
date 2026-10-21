import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { registerHooks } from "node:module";
import { after, before, beforeEach, test } from "node:test";
import { createPinia, setActivePinia } from "pinia";
import { compileScript, compileTemplate, parse } from "vue/compiler-sfc";
import { requiredFields } from "../runtime/utils/requiredFields.js";

const fixtureKey = Symbol.for("framecore-cms.frontend-test");
const fixture = {};
globalThis[fixtureKey] = fixture;
const fixtureSource = `const fixture = globalThis[Symbol.for("framecore-cms.frontend-test")];`;
const sources = {
  "#imports": `${fixtureSource}
    export const useRuntimeConfig = () => fixture.runtimeConfig;`,
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
  setActivePinia(createPinia());
  Object.assign(fixture, {
    runtimeConfig: {
      public: {
        userName: "site",
        userPass: "public-key",
        imageBaseUrl: "https://files.example.test/",
      },
    },
    requests: [],
    reloads: 0,
    tables: [{ id: "products", name: "Products", viewMode: "list" }],
    metadata: {
      graphConfig: { products: [{ type: "bar", labelField: "name" }] },
      staticContentTypes: {
        Home: { header: { copy: { text: "textarea", image: "fileImg" } } },
      },
    },
    respond(url) {
      if (url === "/cms/config") return structuredClone(this.metadata);
      if (url === "/cms/tables") return structuredClone(this.tables);
      throw new Error(`Unexpected request: ${url}`);
    },
  });
  useLoginStore().login("admin@example.test", "admin-password");
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

test("CMS metadata loads once while table loading keeps the existing authentication contract", async () => {
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
    assert.deepEqual(options.body, {
      email: "admin@example.test",
      password: "admin-password",
    });
  }
  assert.deepEqual(store.graphConfig, fixture.metadata.graphConfig);
  assert.deepEqual(
    store.staticContentTypes,
    fixture.metadata.staticContentTypes,
  );
  assert.deepEqual(store.tables, fixture.tables);
  assert.equal(store.loadingFlag, false);
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

test("an expired server session still clears stored credentials and reloads the page", async (t) => {
  t.mock.method(console, "log", () => {});
  fixture.respond = () => {
    throw Object.assign(new Error("Unauthorized"), { status: 401 });
  };
  const store = useCmsStore();
  await store.loadTables();
  assert.equal(useLoginStore().isValid, false);
  assert.equal(useLoginStore().email, null);
  assert.equal(useLoginStore().password, null);
  assert.equal(fixture.reloads, 1);
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
