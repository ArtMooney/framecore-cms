<template>
  <div
    v-if="
      (cmsStore.viewMode !== 'graph' && !cmsStore.selectedTableIsStatic) ||
      cmsStore.adminMode
    "
    class="mx-auto my-12 flex max-w-3xl flex-wrap justify-center gap-4 text-center text-base select-none"
  >
    <div>Add, edit or remove content below</div>

    <div class="flex w-full justify-between">
      <div
        @click="addItem()"
        class="cursor-pointer rounded border border-white/25 bg-[#548b63] px-2 py-1 text-sm hover:bg-[#6bad7d]"
      >
        + Add new item
      </div>

      <div class="relative flex text-sm">
        <div
          @click="showDateList = !showDateList"
          class="cursor-pointer rounded border border-white/25 bg-[#534d75] px-2 py-1 hover:bg-[#5f587f]"
        >
          Sort list by date
        </div>

        <div
          v-if="showDateList"
          @click="showDateList = false"
          class="fixed inset-0 z-0 bg-transparent"
        ></div>

        <div
          v-if="showDateList"
          class="absolute top-0 right-0 z-10 mt-8 min-w-56 rounded bg-black p-4"
        >
          <div class="mb-2 justify-self-end">Choose date field</div>

          <div v-if="getDateList.length < 1" class="w-full text-right">-</div>
          <div
            v-for="date of getDateList"
            @click="sortDateFields(date.name)"
            class="w-full cursor-pointer py-1 text-right hover:bg-white/25"
          >
            {{ date.label }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useLoginStore } from "~/components/cms/stores/loginStore";
import { useCmsStore } from "~/components/cms/stores/cmsStore";

export default {
  name: "AddRemoveItems",

  data() {
    const config = useRuntimeConfig();

    return {
      userName: config.public.userName,
      userPass: config.public.userPass,
      showDateList: false,
      order: "desc",
    };
  },

  computed: {
    getDateList() {
      const dateList = [];

      for (const field of this.cmsStore.schema) {
        if (
          (field.type === "date" || field.type === "dateRange") &&
          !field.hidden
        ) {
          dateList.push({
            name: field.name,
            label: field.label,
          });
        }
      }

      return dateList;
    },

    loginStore() {
      return useLoginStore();
    },

    cmsStore() {
      return useCmsStore();
    },
  },

  methods: {
    addItem() {
      if (this.cmsStore.editingNewItem) return;

      const items = JSON.parse(JSON.stringify(this.cmsStore.items));
      const sortOrder = this.cmsStore.items.length;
      let fields = {};
      fields.sortOrder = sortOrder.toString();

      items.push({
        ...fields,
      });

      this.cmsStore.items = items;
      this.cmsStore.showItem = sortOrder;
      this.cmsStore.itemOpen = true;
      this.cmsStore.editingNewItem = true;

      this.$router.push({
        hash: `#list-item-${items.length - 1}`,
      });
    },

    async sortDateFields(fieldName) {
      if (!this.cmsStore.schema.length) return;

      this.order = this.order === "asc" ? "desc" : "asc";
      await this.cmsStore.loadRows(this.order, fieldName);
      await this.cmsStore.saveSortOrder();
      this.showDateList = false;
    },
  },

  watch: {
    "cmsStore.schema"() {
      this.order = "desc";
    },
  },
};
</script>
