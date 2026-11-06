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
import { useCmsStore } from "./stores/cmsStore.js";

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
    if (!(await this.cmsStore.loadTables())) return;
    await this.loadSchema();
  },

  methods: {
    async loadSchema() {
      const table = this.cmsStore.tables[this.tableIndex];
      if (!table) return;

      this.cmsStore.tableId = table.id;
      this.cmsStore.viewMode = table.viewMode;
      this.cmsStore.backupRef = table.backupRef;
      this.cmsStore.selectedYear = "-";
      this.cmsStore.selectedMonth = "-";
      this.cmsStore.sortOrder = "asc";

      if (!(await this.cmsStore.loadFields())) return;
      const dateField =
        this.cmsStore.allDateFields.find(
          (field) => field.name === this.cmsStore.graphDateField,
        ) ?? this.cmsStore.allDateFields[0];
      this.cmsStore.sortField = dateField?.name ?? "sortOrder";
      this.cmsStore.loadingFlag = true;
      if (
        this.cmsStore.backupRef &&
        !(await this.cmsStore.archiveItems(table.id))
      ) {
        this.cmsStore.loadingFlag = false;
        return;
      }
      await this.cmsStore.loadRows(
        "asc",
        table.viewMode === "graph" ? this.cmsStore.sortField : "sortOrder",
      );
    },
  },

  watch: {
    async tableIndex() {
      await this.loadSchema();
    },
  },
};
</script>
