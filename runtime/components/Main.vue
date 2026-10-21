<script setup>
import CmsAddRemoveItems from "./AddRemoveItems.vue";
import CmsItems from "./Items.vue";
import CmsNavbar from "./Navbar.vue";
import CmsTableList from "./TableList.vue";
</script>

<template>
  <Teleport to="body">
    <div class="cms-admin fixed inset-0 z-20 bg-[#363636] px-4 pb-24">
      <CmsNavbar />
      <CmsTableList />
      <CmsAddRemoveItems />
      <CmsItems />

      <div
        v-if="cmsStore.saveFlag || cmsStore.loadingFlag"
        class="fixed inset-0 z-1000000 block bg-transparent"
      ></div>
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
