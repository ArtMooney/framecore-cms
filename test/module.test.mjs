import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { createUnimport } from "unimport";

const fixtureKey = Symbol.for("framecore-cms.module-test");
const fixture = { modules: new Set(), templates: [] };
globalThis[fixtureKey] = fixture;

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@nuxt/kit") {
      const source = `
        const fixture = globalThis[Symbol.for("framecore-cms.module-test")];
        export const defineNuxtModule = value => value;
        export const createResolver = url => ({resolve: path => new URL(path, url).pathname});
        export const hasNuxtModule = name => fixture.modules.has(name);
        export const addTemplate = template => {
          const resolved = { ...template, dst: "/build/" + template.filename };
          fixture.templates.push(resolved);
          return resolved;
        };
        export const addServerHandler = () => {};
        export const extendPages = () => {};
        export const extendRouteRules = () => {};
        export const installModule = () => {};
      `;
      return {
        url: `data:text/javascript,${encodeURIComponent(source)}`,
        shortCircuit: true,
      };
    }
    if (specifier === "#test-image") {
      return {
        url: 'data:text/javascript,export const useImage = () => "host-image-optimizer";',
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
after(() => {
  hooks.deregister();
  delete globalThis[fixtureKey];
});
const module = (await import("../module.mjs")).default;

async function configuredModule(modules = []) {
  fixture.modules = new Set(["@pinia/nuxt", ...modules]);
  fixture.templates = [];
  const callbacks = new Map();
  const options = {
    rootDir: fileURLToPath(new URL("../", import.meta.url)),
    nitro: {},
    build: { transpile: [] },
    css: [],
    vite: {},
    runtimeConfig: { public: {} },
  };
  await module.setup(
    { config: "module.mjs" },
    {
      options,
      hook: (name, callback) => callbacks.set(name, callback),
    },
  );
  return {
    options,
    configureVite: callbacks.get("vite:extend"),
    imageTemplate: fixture.templates[0],
  };
}

test("a consuming site gets Tailwind automatically and the CMS config is included", async () => {
  const { options, configureVite } = await configuredModule();
  assert(options.css.some((path) => path.endsWith("/runtime/cms.css")));
  const config = {};
  configureVite({ config });
  assert(
    config.plugins.some((plugin) =>
      plugin.name.startsWith("@tailwindcss/vite"),
    ),
  );
});

test("a consuming site's existing Tailwind plugin is reused", async () => {
  const { configureVite } = await configuredModule();
  const existing = { name: "@tailwindcss/vite:generate:build" };
  const config = { plugins: [[existing]] };
  configureVite({ config });
  assert.deepEqual(config.plugins, [[existing]]);
});

test("image previews need no Nuxt Image dependency when the host omits it", async () => {
  const { options, imageTemplate } = await configuredModule();
  assert.equal(options.alias["#framecore-cms/image"], imageTemplate.dst);
  const fallback = await import(
    `data:text/javascript,${encodeURIComponent(imageTemplate.getContents())}`
  );
  assert.equal(fallback.useCmsImage(), null);
});

test("image previews use Nuxt Image regardless of module registration order", async () => {
  for (const registeredBeforeSetup of [true, false]) {
    const { imageTemplate } = await configuredModule(
      registeredBeforeSetup ? ["@nuxt/image"] : [],
    );
    fixture.modules.add("@nuxt/image");
    const imports = createUnimport({
      parser: "oxc",
      virtualImports: ["#imports"],
      imports: [{ name: "useImage", from: "#test-image" }],
    });
    const { code } = await imports.injectImports(
      imageTemplate.getContents(),
      imageTemplate.dst,
    );
    assert.doesNotMatch(code, /["']#imports["']/);
    const adapter = await import(
      `data:text/javascript,${encodeURIComponent(code)}`
    );
    assert.equal(adapter.useCmsImage(), "host-image-optimizer");
  }
});
