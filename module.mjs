import { existsSync, readdirSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import {
  addServerHandler,
  createResolver,
  defineNuxtModule,
  extendPages,
  extendRouteRules,
  hasNuxtModule,
  installModule,
} from "@nuxt/kit";

export default defineNuxtModule({
  meta: {
    name: "framecore-cms",
    configKey: "cms",
    compatibility: { nuxt: "^4.6.4" },
  },
  defaults: { config: "./server/cms.config.ts" },
  async setup(options, nuxt) {
    const { resolve } = createResolver(import.meta.url);
    const configFile = resolvePath(nuxt.options.rootDir, options.config);
    if (!existsSync(configFile)) {
      throw new Error(
        `framecore-cms: CMS config not found: ${configFile}. Create it or set cms.config in nuxt.config.ts.`,
      );
    }

    // The site's database objects stay on the server; only the metadata API
    // exposes the graph and content definitions needed by the admin UI.
    nuxt.options.nitro.alias ||= {};
    nuxt.options.nitro.alias["#framecore-cms/config"] = configFile;
    nuxt.options.build.transpile.push(resolve("./runtime"));
    nuxt.options.css.push(resolve("./runtime/cms.css"));
    nuxt.hook("vite:extend", ({ config }) => {
      config.plugins ||= [];
      const hasTailwind = config.plugins
        .flat(Infinity)
        .some((plugin) => plugin?.name?.startsWith("@tailwindcss/vite"));
      if (!hasTailwind) config.plugins.push(...tailwindcss());
    });

    if (!hasNuxtModule("@pinia/nuxt", nuxt) && !hasNuxtModule("pinia", nuxt)) {
      await installModule(fileURLToPath(import.meta.resolve("@pinia/nuxt")));
    }
    if (
      !hasNuxtModule("pinia-plugin-persistedstate/nuxt", nuxt) &&
      !hasNuxtModule("pinia-plugin-persistedstate", nuxt)
    ) {
      await installModule(
        fileURLToPath(import.meta.resolve("pinia-plugin-persistedstate/nuxt")),
      );
    }

    // Linked checkouts have their own dependencies. Share the host's Vue and
    // Pinia instances, just as a normal hoisted package installation does.
    nuxt.options.vite.server ||= {};
    nuxt.options.vite.server.fs ||= {};
    nuxt.options.vite.server.fs.allow ||= [];
    nuxt.options.vite.server.fs.allow.push(resolve("./runtime"));
    nuxt.options.vite.resolve ||= {};
    nuxt.options.vite.resolve.dedupe = [
      ...new Set([...(nuxt.options.vite.resolve.dedupe || []), "vue", "pinia"]),
    ];

    const config = nuxt.options.runtimeConfig;
    for (const key of [
      "userName",
      "userPass",
      "mailgunApiKey",
      "emailFrom",
      "cmsMailgunDomain",
    ]) {
      config[key] ??= "";
    }
    config.cmsMailgunBaseUrl ??= "https://api.eu.mailgun.net";
    for (const key of ["userName", "userPass", "imageBaseUrl"]) {
      config.public[key] ??= "";
    }

    extendPages((pages) => {
      if (pages.some((page) => page.path === "/admin")) {
        throw new Error(
          "framecore-cms: /admin is already defined. Remove the local admin page before enabling the module.",
        );
      }
      pages.push({
        name: "framecore-cms-admin",
        path: "/admin",
        file: resolve("./runtime/pages/admin.vue"),
      });
    });
    extendRouteRules("/admin", {
      ssr: false,
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });

    const routesDir = resolve("./runtime/server/routes");
    for (const name of readdirSync(routesDir).filter((file) =>
      file.endsWith(".js"),
    )) {
      addServerHandler({
        route: `/cms/${name.slice(0, -3)}`,
        handler: resolvePath(routesDir, name),
      });
    }
  },
});
