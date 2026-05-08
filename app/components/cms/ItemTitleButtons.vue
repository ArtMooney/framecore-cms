<template>
  <div class="col-span-2 flex justify-end gap-2">
    <div class="flex items-center gap-2">
      <div
        v-if="
          ((cmsStore.showItem !== index || !cmsStore.editingNewItem) &&
            !cmsStore.selectedTableIsStatic) ||
          cmsStore.adminMode
        "
        @click.stop="cmsStore.deleteItem(index)"
        class="rounded border border-white/25 bg-[#8a548b] px-2 py-0.5 text-sm hover:bg-[#b280b4]"
      >
        Delete
      </div>
    </div>

    <div
      v-if="index === cmsStore.showItem && cmsStore.itemOpen"
      @click.stop="cmsStore.saveItem(index)"
      class="rounded border border-white/25 bg-[#8a548b] px-2 py-0.5 text-sm hover:bg-[#b280b4]"
      :class="[cmsStore.inputError ? 'opacity-50' : '']"
    >
      Save
    </div>

    <div
      v-if="index === cmsStore.showItem && cmsStore.itemOpen"
      @click.stop="cmsStore.cancelItem(index)"
      class="rounded border border-white/25 bg-[#8a548b] px-2 py-0.5 text-sm hover:bg-[#b280b4]"
    >
      Cancel
    </div>
  </div>
</template>

<script>
import { useCmsStore } from "~/components/cms/stores/cmsStore";

export default {
  name: "ItemTitleButtons",

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
