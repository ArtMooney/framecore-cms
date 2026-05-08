<template>
  <div class="flex flex-col items-center px-4 py-12 md:px-8">
    <form
      v-if="!isChanged"
      @submit.prevent
      class="grid w-full gap-2 sm:w-2/3 md:w-1/2"
      name="new-password"
    >
      <div>New password</div>

      <input
        v-model="inputPasswordOne"
        name="password"
        type="password"
        placeholder="Enter new password"
        required
        autocomplete="new-password"
        class="text-base"
      />

      <input
        v-model="inputPasswordTwo"
        name="confirmPassword"
        type="password"
        placeholder="Enter new password again"
        required
        autocomplete="new-password"
        class="text-base"
      />

      <button
        @click="newPasswordForm"
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
      v-html="statusMessage"
    ></div>
  </div>
</template>

<script>
export default {
  name: "NewPasswordPanel",

  props: {
    validation: {
      type: String,
      required: false,
      default: "",
    },
  },

  data() {
    const config = useRuntimeConfig();

    return {
      userName: config.public.userName,
      userPass: config.public.userPass,
      inputPasswordOne: "",
      inputPasswordTwo: "",
      showStatusMessage: false,
      statusMessage: "",
      buttonText: "Change password",
      isChanged: false,
    };
  },

  methods: {
    async newPasswordForm(event) {
      if (this.inputPasswordOne !== this.inputPasswordTwo) {
        this.statusMessage =
          "You must enter the same password twice to confirm your new password.";
        this.showStatusMessage = true;

        this.clearErrorWhenClicked();
      }

      if (
        requiredFields(event.target.parentElement) &&
        this.inputPasswordOne === this.inputPasswordTwo
      ) {
        const savedText = this.buttonText;
        this.buttonText = event.target.dataset.wait;

        try {
          await $fetch("/cms/new-password", {
            method: "POST",
            headers: {
              Authorization:
                "Basic " + btoa(this.userName + ":" + this.userPass),
            },
            body: JSON.stringify({
              password: this.inputPasswordOne,
              validation: this.validation,
            }),
          });

          this.statusMessage =
            "Your password has been successfully changed. <a href='/admin' class='underline'>Click here to login.</a>";
          this.showStatusMessage = true;
          this.isChanged = true;
          this.buttonText = savedText;
          this.inputPasswordOne = "";
          this.inputPasswordTwo = "";

          this.clearErrorWhenClicked();
        } catch (err) {
          this.statusMessage =
            err.statusMessage || "Something went wrong. Please try again.";
          this.showStatusMessage = true;
          this.isChanged = false;
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
