import type { NuxtModule } from "@nuxt/schema";

export interface ModuleOptions {
  /** Path to a server-only file exporting schema and CMS metadata. */
  config?: string;
}

declare const module: NuxtModule<ModuleOptions>;
export default module;

declare module "@nuxt/schema" {
  interface NuxtConfig {
    cms?: ModuleOptions;
  }
  interface NuxtOptions {
    cms: ModuleOptions;
  }
}
