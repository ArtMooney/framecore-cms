<script setup>
import IconSystemUiconsHomeDoor from "~icons/system-uicons/home-door";
import IconFamiconsCogSharp from "~icons/famicons/cog-sharp";
</script>

<template>
  <div class="flex items-center justify-between px-2 py-8 text-base sm:py-4">
    <IconSystemUiconsHomeDoor
      @click="backHomepage"
      class="mb-1.5 h-7 min-h-7 w-7 min-w-7 shrink-0 cursor-pointer hover:text-white/75"
    ></IconSystemUiconsHomeDoor>

    <div class="flex flex-col items-center gap-2 text-center sm:flex-row">
      <h1 class="mb-0 text-2xl sm:text-4xl">{{ cmsName }}</h1>
      <div class="hidden text-xs sm:block">by FrameCore</div>
    </div>

    <div class="relative">
      <IconFamiconsCogSharp
        @click="cmsSettingsMenu = !cmsSettingsMenu"
        class="h-7 min-h-7 w-7 min-w-7 shrink-0 cursor-pointer hover:text-white/75"
      ></IconFamiconsCogSharp>

      <div
        v-if="cmsSettingsMenu"
        @click="cmsSettingsMenu = false"
        class="fixed inset-0 z-0 bg-transparent"
      ></div>

      <div
        v-show="cmsSettingsMenu"
        class="absolute right-2 mt-4 min-w-40 bg-black/90 p-4"
      >
        <div
          @click="logOut"
          class="cursor-pointer text-center hover:text-white/50"
        >
          Log out
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useLoginStore } from "~/components/cms/stores/loginStore";

export default {
  name: "Navbar",

  data() {
    return {
      cmsSettingsMenu: false,
      cmsName: "{{ simple }} CMS",
    };
  },

  computed: {
    loginStore() {
      return useLoginStore();
    },
  },

  methods: {
    backHomepage() {
      const protocol = window.location.protocol + "//";
      const siteDomain = window.location.host;

      window.location.href = protocol + siteDomain;
    },

    logOut() {
      this.loginStore.logout();
      location.reload();
    },
  },
};
</script>
