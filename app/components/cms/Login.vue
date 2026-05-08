<template>
  <div class="py-32">
    <CmsLoginPanel
      v-if="panel === 'login'"
      @reset-password-switch="switchPanel('resetPassword')"
    />

    <CmsResetPasswordPanel
      v-if="panel === 'resetPassword'"
      @login-switch="switchPanel('login')"
    />

    <CmsNewPasswordPanel
      v-if="panel === 'newPassword'"
      :validation="validationCode"
      @login-switch="switchPanel('login')"
    />

    <CmsLoadingSpinner v-if="panel === 'loading'" class="justify-self-center" />

    <div class="flex flex-col items-center px-4 md:px-8">
      <div
        v-if="showStatusMessage"
        class="w-full justify-self-center bg-orange-400/70 p-4 text-base text-black sm:w-2/3 md:w-1/2"
      >
        {{ statusMessage }}
      </div>
    </div>
  </div>
</template>

<script>
import { useLoginStore } from "~/components/cms/stores/loginStore";

export default {
  name: "Login",

  data() {
    const config = useRuntimeConfig();

    return {
      panel: "login",
      userName: config.public.userName,
      userPass: config.public.userPass,
      validationCode: "",
      showStatusMessage: false,
      statusMessage: "Couldn't validate your code, rerouted to the login page.",
    };
  },

  computed: {
    loginStore() {
      return useLoginStore();
    },
  },

  async mounted() {
    await this.loginHandler();
  },

  methods: {
    async loginHandler() {
      const hrefCheck = window.location.href.split("?");
      let isPasswordSwitch = false;

      if (hrefCheck.length > 1) {
        const varCheck = hrefCheck[1].split("=");

        if (varCheck[0] === "validation" && varCheck[1]) {
          this.panel = "loading";

          try {
            const res = await $fetch("/cms/validate", {
              method: "POST",
              headers: {
                Authorization:
                  "Basic " + btoa(this.userName + ":" + this.userPass),
              },
              body: JSON.stringify({
                validation: varCheck[1],
              }),
            });

            isPasswordSwitch = true;
            this.validationCode = varCheck[1];
          } catch (err) {
            this.showStatusMessage = true;
            this.clearErrorWhenClicked();
          }
        }
      }

      if (isPasswordSwitch) {
        this.switchPanel("newPassword");
      } else if (!this.loginStore.isValid) {
        this.switchPanel("login");
      }
    },

    switchPanel(panelName) {
      this.panel = panelName;

      const urlWithoutQueryString = window.location.href.split("?")[0];
      history.replaceState({}, document.title, urlWithoutQueryString);
    },

    clearErrorWhenClicked() {
      setTimeout(() => {
        window.addEventListener(
          "click",
          () => {
            this.showStatusMessage = false;
          },
          { once: true },
        );
      }, 500);
    },
  },
};
</script>
