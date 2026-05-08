<script setup>
import IconFa7SolidGridVertical from "~icons/fa7-solid/grid-vertical";
import IconIonChevronDown from "~icons/ion/chevron-down";
</script>

<template>
  <div class="col-span-2 flex cursor-pointer justify-between">
    <div class="flex items-center gap-4">
      <IconFa7SolidGridVertical
        class="dragdrop-handle h-5 min-h-5 w-5 min-w-5 shrink-0 cursor-grabbing text-white"
      ></IconFa7SolidGridVertical>

      <div
        class="word-break-all font-heading pointer-events-none mr-4 hyphens-auto"
        lang="sv"
      >
        {{ item?.name ? item?.name : item?.title }}
      </div>
    </div>

    <div class="flex cursor-pointer gap-2">
      <CmsItemTitleButtons class="hidden sm:flex" :item="item" :index="index" />

      <div class="flex items-center gap-2">
        <IconIonChevronDown
          v-if="
            !cmsStore.saveAllFlag &&
            (index !== cmsStore.showItem || !cmsStore.saveFlag)
          "
          class="h-6 min-h-6 w-6 min-w-6 text-white transition-transform duration-300 ease-in-out"
          :class="[
            index === cmsStore.showItem && cmsStore.itemOpen
              ? 'rotate-180'
              : '',
          ]"
        ></IconIonChevronDown>

        <CmsLoadingSpinner
          v-if="
            (index === cmsStore.showItem && cmsStore.saveFlag) ||
            cmsStore.saveAllFlag
          "
          class="size-5"
          color="#fac725"
        />
      </div>
    </div>
  </div>

  <CmsItemTitleButtons
    v-if="index === cmsStore.showItem && cmsStore.itemOpen"
    class="mt-4 flex justify-self-start sm:hidden"
    :item="item"
    :index="index"
  />
</template>

<script>
import { useCmsStore } from "~/components/cms/stores/cmsStore";

export default {
  name: "CmsItemTitle",

  props: {
    item: {
      type: Object,
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
  },

  computed: {
    cmsStore() {
      return useCmsStore();
    },
  },
};
</script>
