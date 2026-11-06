<template>
  <div class="mb-12 flex flex-col gap-4 sm:flex-row">
    <div class="flex gap-4 sm:contents">
      <label class="w-full font-semibold text-white/50 italic">
        Year:

        <select v-model="cmsStore.selectedYear">
          <option
            v-for="(year, index) in ['-', ...cmsStore.selectorYears(dateField)]"
            :key="index"
            :value="year"
          >
            {{ year }}
          </option>
        </select>
      </label>

      <label class="w-full font-semibold text-white/50 italic">
        Month:

        <select
          v-model="cmsStore.selectedMonth"
          :disabled="cmsStore.selectedYear === '-'"
        >
          <option v-for="month in ['-', ...months]" :key="month" :value="month">
            {{ month }}
          </option>
        </select>
      </label>
    </div>

    <label class="w-full font-semibold text-white/50 italic">
      Show as:

      <select :value="cmsStore.showAs" @change="onShowAsChange">
        <option
          v-for="option in showAsOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </label>

    <label
      v-if="cmsStore.showAs === 'list'"
      class="w-full font-semibold text-white/50 italic"
    >
      Sort as:

      <select :value="sortAsValue" @change="onSortAsChange">
        <option
          v-for="option in sortAsOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </label>
  </div>
</template>

<script>
import { useCmsStore } from "./stores/cmsStore.js";
import { months } from "./lib/months.js";
import {
  formatFieldLabel,
  formatFieldValue,
} from "../utils/fieldFormatting.js";

export default {
  name: "GraphSelectors",

  data() {
    return {
      months,
      showAsOptions: [
        { value: "graph", label: "Graph" },
        { value: "list", label: "List" },
        { value: "csv", label: "Save to CSV" },
      ],
    };
  },

  props: {
    graphSettings: {
      type: Object,
      required: true,
    },
  },

  computed: {
    cmsStore() {
      return useCmsStore();
    },

    dateField() {
      return this.graphSettings?.dateField ?? this.cmsStore.graphDateField;
    },

    sortAsValue() {
      return `${this.cmsStore.sortField}:${this.cmsStore.sortOrder}`;
    },

    sortAsOptions() {
      const fields = this.cmsStore.allDateFields.length
        ? this.cmsStore.allDateFields
        : [{ name: this.dateField, label: "Date" }];

      return fields.flatMap((field) => {
        const label = field.label || formatFieldLabel(field.name);

        return [
          { value: `${field.name}:asc`, label: `${label} (asc)` },
          { value: `${field.name}:desc`, label: `${label} (desc)` },
        ];
      });
    },
  },

  methods: {
    onShowAsChange(event) {
      const value = event.target.value;

      if (value === "csv") {
        this.exportCsv();
        event.target.value = this.cmsStore.showAs;
        return;
      }

      this.cmsStore.showAs = value;
    },

    async onSortAsChange(event) {
      const [field, order] = event.target.value.split(":");

      this.cmsStore.sortField = field;
      this.cmsStore.sortOrder = order;
      await this.cmsStore.loadRows(order, field);
    },

    exportCsv() {
      const items = this.cmsStore.filteredSelectItems(this.dateField);
      const fields = this.cmsStore.visibleFields;
      const header = fields
        .map((field) => this.escapeCsv(field.label))
        .join(",");
      const rows = items.map((item) =>
        fields
          .map((field) =>
            this.escapeCsv(formatFieldValue(item[field.name], field.type)),
          )
          .join(","),
      );

      const csv = `\uFEFF${[header, ...rows].join("\n")}`;
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = this.buildFileName();
      link.click();
      URL.revokeObjectURL(url);
    },

    buildFileName() {
      const parts = [this.cmsStore.tableId];

      if (this.cmsStore.selectedYear !== "-") {
        parts.push(String(this.cmsStore.selectedYear));
      }

      if (this.cmsStore.selectedMonth !== "-") {
        parts.push(this.cmsStore.selectedMonth.toLowerCase());
      }

      return `${parts.join("-")}.csv`;
    },

    escapeCsv(value) {
      const stringValue = String(value ?? "");

      if (/[",\n\r]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    },
  },

  watch: {
    "cmsStore.selectedYear"() {
      if (this.cmsStore.selectedYear === "-") {
        this.cmsStore.selectedMonth = "-";
      }
    },
  },
};
</script>
