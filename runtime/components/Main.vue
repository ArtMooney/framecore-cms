<script setup>
import CmsAddRemoveItems from "./AddRemoveItems.vue";
import CmsItems from "./Items.vue";
import CmsNavbar from "./Navbar.vue";
import CmsTableList from "./TableList.vue";
</script>

<template>
  <Teleport to="body">
    <div class="cms-admin">
      <div class="fixed inset-0 z-20 overflow-x-hidden bg-[#363636] px-4 pb-24">
        <CmsNavbar />
        <div
          v-if="cmsStore.errorMessage"
          role="alert"
          class="mx-auto my-4 max-w-3xl rounded bg-orange-400/70 p-4 text-black"
        >
          <p>{{ cmsStore.errorMessage }}</p>
          <button
            type="button"
            class="mt-2 px-0 underline"
            @click="cmsStore.errorMessage = ''"
          >
            Dismiss
          </button>
        </div>
        <CmsTableList />
        <CmsAddRemoveItems />
        <CmsItems />

        <div
          v-if="cmsStore.saveFlag || cmsStore.loadingFlag"
          class="fixed inset-0 z-1000000 block bg-transparent"
        ></div>
      </div>
    </div>
  </Teleport>
</template>

<script>
import { useCmsStore } from "./stores/cmsStore.js";

export default {
  name: "Main",

  computed: {
    cmsStore() {
      return useCmsStore();
    },
  },

  mounted() {
    window.scrollTo(0, 0);
  },
};
</script>
