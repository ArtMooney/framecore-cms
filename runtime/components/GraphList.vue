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
        <div class="flex flex-col gap-1 border-white/15 sm:border-r sm:pr-4">
          <div class="text-xs text-white/50">
            {{ formatDateValue(item[dateField]) }}
          </div>
          <div
            class="font-heading text-lg wrap-break-word hyphens-auto"
            lang="sv"
          >
            {{ item.title || item.name || "—" }}
          </div>
          <div v-if="item.time" class="text-sm text-white/70">
            {{ item.time }}
          </div>
        </div>

        <div class="flex flex-col gap-1 text-sm text-white/80 sm:pl-4">
          <div v-if="item.venue">
            <span class="text-white/50">Venue:</span> {{ item.venue }}
          </div>
          <div v-if="item.company">
            <span class="text-white/50">Company:</span> {{ item.company }}
          </div>
          <div v-if="item.name">
            <span class="text-white/50">Name:</span> {{ item.name }}
          </div>
          <div v-if="item.phone">
            <span class="text-white/50">Phone:</span> {{ item.phone }}
          </div>
          <div v-if="item.email">
            <span class="text-white/50">Email:</span> {{ item.email }}
          </div>
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
import { months } from "./lib/months.js";

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
    goToPage(page) {
      if (page < 1 || page > this.totalPages) return;
      this.currentPage = page;
    },

    formatDateValue(dateValue) {
      if (!dateValue) return "—";

      if (Array.isArray(dateValue)) {
        const start = this.formatDate(dateValue[0]);
        const end = this.formatDate(dateValue[1]);

        if (!start) return "—";
        if (!end || start === end) return start;

        return `${start} – ${end}`;
      }

      return this.formatDate(dateValue) || "—";
    },

    formatDate(date) {
      if (!date) return "";

      const dateObj = new Date(date);
      if (Number.isNaN(dateObj.getTime())) return "";

      const day = dateObj.getDate();
      const month = months[dateObj.getMonth()];
      const year = dateObj.getFullYear();

      return `${day} ${month} ${year}`;
    },
  },
};
</script>
