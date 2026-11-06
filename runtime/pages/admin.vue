<script setup>
import { definePageMeta, useSeoMeta } from "#imports";
import { onMounted, onUnmounted, ref } from "vue";
import CmsLoadingSpinner from "../components/LoadingSpinner.vue";
import CmsLogin from "../components/Login.vue";
import CmsMain from "../components/Main.vue";
import { useLoginStore } from "../components/stores/loginStore.js";

const loginStore = useLoginStore();
const showSessionSpinner = ref(false);
let spinnerTimer;

onMounted(async () => {
  spinnerTimer = setTimeout(() => {
    showSessionSpinner.value = true;
  }, 200);
  try {
    await loginStore.restore();
  } finally {
    clearTimeout(spinnerTimer);
  }
});
onUnmounted(() => clearTimeout(spinnerTimer));

definePageMeta({ layout: false });
useSeoMeta({ title: "CMS", robots: "noindex, nofollow" });
</script>

<template>
  <div class="cms-admin">
    <div class="min-h-screen bg-neutral-900 text-white">
      <div v-if="!loginStore.initialized" class="flex justify-center py-32">
        <CmsLoadingSpinner v-if="showSessionSpinner" />
      </div>
      <CmsLogin
        v-else-if="!loginStore.isValid"
        class="mx-auto w-full max-w-7xl"
      />
      <CmsMain v-else />
    </div>
  </div>
</template>
