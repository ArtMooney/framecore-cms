import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@nuxt/kit") {
      const source = `
        export const defineNuxtModule = value => value;
        export const createResolver = url => ({resolve: path => new URL(path, url).pathname});
        export const hasNuxtModule = () => true;
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
    return nextResolve(specifier, context);
  },
});
after(() => hooks.deregister());
const module = (await import("../module.mjs")).default;

async function configuredModule() {
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
  return { options, configureVite: callbacks.get("vite:extend") };
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
