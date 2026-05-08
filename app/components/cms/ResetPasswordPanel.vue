<template>
  <div class="flex flex-col items-center px-4 py-12 md:px-8">
    <form
      @submit.prevent
      class="grid w-full gap-2 sm:w-2/3 md:w-1/2"
      name="reset-password"
    >
      <div>Reset password</div>

      <input
        v-model="loginEmail"
        name="email"
        type="email"
        placeholder="Enter email address"
        autocomplete="email"
        class="text-base"
      />

      <button
        @click="resetPasswordForm"
        type="submit"
        data-wait="Please wait..."
        class="mt-4 bg-[#548b63] text-white hover:bg-[#6bad7d]"
      >
        {{ buttonText }}
      </button>

      <div
        @click="$emit('loginSwitch')"
        class="flex cursor-pointer justify-self-start text-sm underline hover:text-neutral-400"
      >
        Know your password?
      </div>
    </form>

    <div
      v-if="showStatusMessage"
      class="mt-12 w-full bg-orange-400/70 p-4 text-base text-black sm:w-2/3 md:w-1/2"
    >
      {{ statusMessage }}
    </div>
  </div>
</template>

<script>
export default {
  name: "ResetPasswordPanel",

  data() {
    const config = useRuntimeConfig();

    return {
      userName: config.public.userName,
      userPass: config.public.userPass,
      resetPasswordPanel: false,
      loginEmail: "",
      showStatusMessage: false,
      statusMessage: "",
      buttonText: "Send password reset link",
    };
  },

  methods: {
    async resetPasswordForm(event) {
      if (!emailValidator(event.target.parentElement)) {
        this.statusMessage =
          "One or more email addresses that you have provided do not appear to have a correct format.";
        this.showStatusMessage = true;

        this.clearErrorWhenClicked();
      }

      if (
        requiredFields(event.target.parentElement) &&
        emailValidator(event.target.parentElement)
      ) {
        const savedText = this.buttonText;
        this.buttonText = event.target.dataset.wait;

        try {
          await $fetch("/cms/reset", {
            method: "POST",
            headers: {
              Authorization:
                "Basic " + btoa(this.userName + ":" + this.userPass),
            },
            body: JSON.stringify({
              email: this.loginEmail,
              pageuri: window.location.href,
            }),
          });

          this.statusMessage =
            "An email has been sent to your registered email address with a link to reset your password.";
          this.showStatusMessage = true;
          this.buttonText = savedText;
          this.loginEmail = "";
          this.clearErrorWhenClicked();
        } catch (err) {
          this.statusMessage =
            err.statusMessage || "Something went wrong. Please try again.";
          this.showStatusMessage = true;
          this.buttonText = savedText;

          this.clearErrorWhenClicked();
        }
      }
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
