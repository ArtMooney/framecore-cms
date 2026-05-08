/**
 * Playground app — used during layer development as a real consumer.
 * From this dir's perspective, the parent dir IS the layer.
 */
export default defineNuxtConfig({
  extends: [".."],

  devtools: { enabled: true },

  css: ["~/assets/css/main.css"],

  nitro: {
    preset: "cloudflare_module",
  },
});
