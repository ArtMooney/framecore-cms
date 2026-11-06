<template>
  <div class="mb-12 flex flex-col gap-3">
    <div
      v-if="items.length === 0"
      class="py-8 text-center text-white/50 italic"
    >
      No items found for the selected period
    </div>

    <template v-else>
      <div
        v-for="(item, index) in pagedItems"
        :key="item.id ?? index"
        class="grid grid-cols-1 gap-2 rounded bg-black/25 p-4 shadow-[3px_4px_12px_rgba(0,0,0,0.22)] sm:grid-cols-2"
      >
        <div
          v-for="field in cmsStore.visibleFields"
          :key="field.name"
          class="flex flex-col gap-1 text-sm text-white/80"
        >
          <span class="text-xs text-white/50">{{ field.label }}</span>
          <span class="wrap-break-word whitespace-pre-wrap">{{
            formatFieldValue(item[field.name], field.type) || "—"
          }}</span>
        </div>
      </div>

      <div
        v-if="totalPages > 1"
        class="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm"
      >
        <button
          type="button"
          class="rounded border border-white/25 px-3 py-1.5 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          :disabled="currentPage <= 1"
          @click="goToPage(currentPage - 1)"
        >
          Previous
        </button>

        <button
          v-for="page in pageNumbers"
          :key="page"
          type="button"
          class="min-w-9 rounded border px-3 py-1.5 transition-colors"
          :class="
            page === currentPage
              ? 'border-white/50 bg-white/15'
              : 'border-white/25 hover:bg-white/10'
          "
          @click="goToPage(page)"
        >
          {{ page }}
        </button>

        <button
          type="button"
          class="rounded border border-white/25 px-3 py-1.5 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
          :disabled="currentPage >= totalPages"
          @click="goToPage(currentPage + 1)"
        >
          Next
        </button>
      </div>
    </template>
  </div>
</template>

<script>
import { useCmsStore } from "./stores/cmsStore.js";
import { formatFieldValue } from "../utils/fieldFormatting.js";

const PAGE_SIZE = 50;

export default {
  name: "GraphList",

  props: {
    dateField: {
      type: String,
      default: "date",
    },
  },

  data() {
    return {
      currentPage: 1,
    };
  },

  computed: {
    cmsStore() {
      return useCmsStore();
    },

    items() {
      return this.cmsStore.filteredSelectItems(this.dateField);
    },

    totalPages() {
      return Math.max(1, Math.ceil(this.items.length / PAGE_SIZE));
    },

    pagedItems() {
      const start = (this.currentPage - 1) * PAGE_SIZE;
      return this.items.slice(start, start + PAGE_SIZE);
    },

    pageNumbers() {
      return Array.from({ length: this.totalPages }, (_, i) => i + 1);
    },
  },

  watch: {
    "cmsStore.selectedYear"() {
      this.currentPage = 1;
    },

    "cmsStore.selectedMonth"() {
      this.currentPage = 1;
    },

    "cmsStore.sortField"() {
      this.currentPage = 1;
    },

    "cmsStore.sortOrder"() {
      this.currentPage = 1;
    },

    items() {
      if (this.currentPage > this.totalPages) {
        this.currentPage = this.totalPages;
      }
    },
  },

  methods: {
    formatFieldValue,

    goToPage(page) {
      if (page < 1 || page > this.totalPages) return;
      this.currentPage = page;
    },
  },
};
</script>
