<template>
  <label class="mb-12 w-full font-semibold text-white/50 italic">
    <span class="my-12">
      {{ graphSettings?.datasets?.[0]?.label ?? "Graph" }}
    </span>

    <Bar
      v-if="graphSettings?.type === 'bar'"
      :data="chartData"
      :options="chartOptions"
      class="h-auto max-h-100"
    />
    <Line
      v-else-if="graphSettings?.type === 'line'"
      :data="chartData"
      :options="chartOptions"
      class="h-auto max-h-100"
    />
    <Pie
      v-else-if="graphSettings?.type === 'pie'"
      :data="chartData"
      :options="chartOptions"
    />
  </label>
</template>

<script>
import { useCmsStore } from "~/components/cms/stores/cmsStore";
import { Bar, Line, Pie } from "vue-chartjs";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
);

export default {
  name: "Graph",

  components: {
    Bar,
    Line,
    Pie,
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

    labels() {
      const config = this.graphSettings;
      if (!config) return [];

      const items = this.cmsStore.filteredSelectItems(config.dateField);
      const uniqueLabels = [
        ...new Set(items.map((item) => item[config.labelField])),
      ].filter(Boolean);

      return uniqueLabels.sort((a, b) => {
        const countA = items.filter(
          (item) => item[config.labelField] === a,
        ).length;
        const countB = items.filter(
          (item) => item[config.labelField] === b,
        ).length;

        return countB - countA;
      });
    },

    chartData() {
      const config = this.graphSettings;
      if (!config) return { labels: [], datasets: [] };

      const datasets = config.datasets.map((ds) => {
        let bgColor = ds.backgroundColor;
        let borderColor = ds.borderColor;

        if (config.type === "pie") {
          const numColors = this.labels.length;
          bgColor = this.getDistinctColors(numColors);
          borderColor = this.getDistinctColors(numColors, true);
        }

        return {
          label: ds.label,
          backgroundColor: bgColor,
          borderColor: borderColor,
          data: this.getChartValues(ds),
        };
      });

      return {
        labels: this.labels,
        datasets,
      };
    },

    chartOptions() {
      const config = this.graphSettings;
      const baseOptions = config?.options ?? {};

      if (config?.showPercentage && config?.type === "pie") {
        return {
          ...baseOptions,
          plugins: {
            ...baseOptions.plugins,
            tooltip: {
              ...baseOptions.plugins?.tooltip,
              callbacks: {
                label: (context) => {
                  const label = context.label || "";
                  const value = context.parsed;
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const percentage = ((value / total) * 100).toFixed(1);
                  return `${label}: ${value} (${percentage}%)`;
                },
              },
            },
          },
        };
      }

      return baseOptions;
    },
  },

  methods: {
    getChartValues() {
      const config = this.graphSettings;
      const items = this.cmsStore.filteredSelectItems(config.dateField);

      return this.labels.map((label) => {
        const matching = items.filter(
          (item) => item[config.labelField] === label,
        );

        return matching.length;
      });
    },

    getDistinctColors(count, darker = false) {
      const colors = [];
      const startHue = 0;
      const endHue = 60;
      const saturation = 100;
      const lightness = darker ? 67 : 70;
      const forwardCount = Math.ceil(count / 2);
      const backwardCount = count - forwardCount;

      for (let i = 0; i < count; i++) {
        let hue;
        if (i < forwardCount) {
          const t = forwardCount > 1 ? i / (forwardCount - 1) : 0;
          hue = startHue + t * (endHue - startHue);
        } else {
          const backIndex = i - forwardCount;
          const t = (backIndex + 1) / (backwardCount + 1);
          hue = endHue - t * (endHue - startHue);
        }
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
      }

      return colors;
    },
  },
};
</script>
