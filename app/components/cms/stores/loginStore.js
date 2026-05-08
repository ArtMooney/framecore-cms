import { defineStore } from "pinia";

const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;

export const useLoginStore = defineStore("loginStore", {
  state: () => ({
    isLoggedIn: false,
    email: null,
    password: null,
    expiresAt: null,
  }),

  getters: {
    isValid() {
      if (this.isLoggedIn && this.expiresAt && Date.now() >= this.expiresAt) {
        return false;
      }

      return this.isLoggedIn;
    },
  },

  actions: {
    login(email, password) {
      this.isLoggedIn = true;
      this.email = email;
      this.password = password;
      this.expiresAt = Date.now() + THIRTY_DAYS;
    },

    logout() {
      this.isLoggedIn = false;
      this.email = null;
      this.password = null;
      this.expiresAt = null;
    },
  },

  persist: true,
});
