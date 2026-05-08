<template>
  <div class="mb-12 flex gap-4">
    <label class="w-full font-semibold text-white/50 italic">
      Year:

      <select v-model="cmsStore.selectedYear">
        <option
          v-for="(year, index) in [
            '-',
            ...cmsStore.selectorYears(graphSettings?.dateField),
          ]"
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
</template>

<script>
import { useCmsStore } from "~/components/cms/stores/cmsStore";

export default {
  name: "GraphSelectors",

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
