<script setup>
import { definePageMeta, useSeoMeta } from "#imports";
import CmsLogin from "../components/Login.vue";
import CmsMain from "../components/Main.vue";
import { useLoginStore } from "../components/stores/loginStore.js";

const loginStore = useLoginStore();

definePageMeta({ layout: false });
useSeoMeta({ title: "CMS", robots: "noindex, nofollow" });
</script>

<template>
  <div class="cms-admin">
    <div class="min-h-screen bg-neutral-900 text-white">
      <CmsLogin v-if="!loginStore.isValid" class="mx-auto w-full max-w-7xl" />
      <CmsMain v-else />
    </div>
  </div>
</template>
