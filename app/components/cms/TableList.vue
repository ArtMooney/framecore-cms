<template>
  <div
    class="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-4 text-base"
  >
    <label class="flex w-full flex-col gap-2">
      <p class="font-semibold text-white/50 italic">
        Choose content table to edit
      </p>

      <select v-model="tableIndex">
        <option v-for="(table, index) of cmsStore.tables" :value="index">
          {{ table.name }}
        </option>
      </select>
    </label>
  </div>
</template>

<script>
import { useCmsStore } from "~/components/cms/stores/cmsStore";

export default {
  name: "TableList",

  data() {
    return {
      tableIndex: 0,
    };
  },

  computed: {
    cmsStore() {
      return useCmsStore();
    },
  },

  async mounted() {
    await this.cmsStore.loadTables();
    await this.loadSchema();
  },

  methods: {
    async loadSchema() {
      const table = this.cmsStore.tables[this.tableIndex];
      this.cmsStore.tableId = table.id;
      this.cmsStore.viewMode = table.viewMode;
      this.cmsStore.backupRef = table.backupRef;

      await this.cmsStore.loadFields();
      this.cmsStore.loadingFlag = true;
      await this.backupReferencedTable(table);
      await this.cmsStore.loadRows("asc", "sortOrder");
    },

    async backupReferencedTable(table) {
      if (!this.cmsStore.backupRef) return;

      this.cmsStore.tableId = this.cmsStore.backupRef;
      await this.cmsStore.loadRows("asc", "sortOrder");
      this.cmsStore.loadingFlag = true;

      const backupItems = this.cmsStore.items.filter(this.isExpiredItem);
      this.cmsStore.tableId = table.id;
      this.cmsStore.items = backupItems;
      await this.cmsStore.addItems();

      this.cmsStore.tableId = this.cmsStore.backupRef;
      await this.cmsStore.deleteItems();

      this.cmsStore.tableId = table.id;
      this.cmsStore.loadingFlag = false;
    },

    isExpiredItem(item) {
      return item?.date?.[1] && new Date(item.date[1]) < new Date();
    },
  },

  watch: {
    async tableIndex() {
      await this.loadSchema();
    },
  },
};
</script>
