import tailwindcss from "@tailwindcss/vite";

/**
 * framecore-cms — Nuxt Layer
 *
 * Consumer projects opt in via:
 *   export default defineNuxtConfig({
 *     extends: ["github:hskoglund/framecore-cms#vX.Y.Z"],
 *   });
 */
export default defineNuxtConfig({
  compatibilityDate: "2026-03-01",

  vite: {
    plugins: [tailwindcss()],
  },

  modules: [
    "unplugin-icons/nuxt",
    "@pinia/nuxt",
    "pinia-plugin-persistedstate/nuxt",
  ],

  runtimeConfig: {
    // Basic-auth gate in front of /cms/* endpoints.
    userName: "",
    userPass: "",

    // Mailgun (password-reset emails).
    mailgunApiKey: "",
    emailFrom: "",
    emailTo: "",
    unsubscribeTo: "",

    public: {
      // Exposed to the browser so the admin UI can call /cms/* with basic auth.
      userName: "",
      userPass: "",
    },
  },
});
