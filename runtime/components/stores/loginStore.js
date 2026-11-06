import { defineStore } from "pinia";
import { cmsRequest, apiErrorMessage } from "../../utils/cmsApi.js";

export const useLoginStore = defineStore("framecore-cms:login", {
  state: () => ({
    isLoggedIn: false,
    initialized: false,
    errorMessage: "",
  }),

  getters: {
    isValid() {
      return this.isLoggedIn;
    },
  },

  actions: {
    async restore() {
      try {
        const session = await cmsRequest("/cms/session");
        this.isLoggedIn = session.authenticated;
        this.errorMessage = "";
      } catch (error) {
        this.isLoggedIn = false;
        this.errorMessage = apiErrorMessage(
          error,
          "Could not check your session. Please try logging in.",
        );
      } finally {
        this.initialized = true;
      }
    },

    async login(email, password) {
      await cmsRequest("/cms/login", {
        method: "POST",
        body: { email, password },
      });
      this.isLoggedIn = true;
      this.initialized = true;
      this.errorMessage = "";
    },

    async logout() {
      await cmsRequest("/cms/logout", { method: "POST" });
      this.clear();
    },

    clear() {
      this.isLoggedIn = false;
      this.initialized = true;
      this.errorMessage = "";
    },
  },
});
