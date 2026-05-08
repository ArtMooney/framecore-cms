<script setup>
useNoIndexSeo("Admin");

definePageMeta({
  ssr: false,
});
</script>

<template>
  <div class="flex w-full grow items-center justify-center">
    <CmsLogin v-if="!loginStore.isValid" class="mx-auto w-full max-w-7xl" />
    <CmsMain v-if="loginStore.isValid" />
  </div>
</template>

<script>
import { useLoginStore } from "~/components/cms/stores/loginStore";

export default {
  name: "Admin",

  computed: {
    loginStore() {
      return useLoginStore();
    },
  },
};
</script>
