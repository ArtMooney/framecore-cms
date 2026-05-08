import { defineStore } from "pinia";
import { useLoginStore } from "~/components/cms/stores/loginStore";

export const useCmsStore = defineStore("cmsStore", {
  state: () => ({
    adminMode: false,
    tables: [],
    items: [],
    itemCopy: null,
    schema: [],
    tableId: "",
    viewMode: "",
    backupRef: null,
    showItem: 0,
    itemOpen: false,
    saveFlag: false,
    saveAllFlag: false,
    loadingFlag: true,
    editingItem: false,
    editingNewItem: false,
    inputError: false,
    formRefs: {},
    selectedYear: "-",
    selectedMonth: "-",
    selectedTableIsStatic: false,
  }),

  getters: {
    hasItems() {
      return this.items.length > 0;
    },

    hasSchema() {
      return this.schema.length > 0;
    },
  },

  actions: {
    async loadTables() {
      this.loadingFlag = true;
      const loginStore = useLoginStore();
      const config = useRuntimeConfig();

      try {
        this.tables = await $fetch("/cms/tables", {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              btoa(config.public.userName + ":" + config.public.userPass),
          },
          body: {
            email: loginStore.email,
            password: loginStore.password,
          },
        });
      } catch (err) {
        if (err.status === 401) {
          loginStore.logout();
          location.reload();
        }

        console.log(err);
      } finally {
        this.loadingFlag = false;
      }
    },

    async loadFields() {
      this.loadingFlag = true;
      const loginStore = useLoginStore();
      const config = useRuntimeConfig();

      try {
        this.schema = await $fetch("/cms/fields", {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              btoa(config.public.userName + ":" + config.public.userPass),
          },
          body: {
            email: loginStore.email,
            password: loginStore.password,
            table_id: this.tableId,
          },
        });

        this.editingItem = false;
        this.editingNewItem = false;
        this.showItem = 0;
        this.itemOpen = false;
        this.inputError = false;
      } catch (err) {
        if (err.status === 401) {
          loginStore.logout();
          location.reload();
        }

        console.log(err);
      } finally {
        this.loadingFlag = false;
      }
    },

    async loadRows(sortOrder, fieldName) {
      if (!this.hasSchema) return;

      this.loadingFlag = true;
      const loginStore = useLoginStore();
      const config = useRuntimeConfig();

      try {
        this.items = await $fetch("/cms/rows", {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              btoa(config.public.userName + ":" + config.public.userPass),
          },
          body: {
            email: loginStore.email,
            password: loginStore.password,
            table_id: this.tableId,
            field_name: fieldName,
            sort_order: sortOrder,
          },
        });
      } catch (err) {
        if (err.status === 401) {
          loginStore.logout();
          location.reload();
        }

        console.log(err);
      } finally {
        this.selectedTableIsStatic = this.tableId === "static_content";
        this.loadingFlag = false;
      }
    },

    cancelItem(index) {
      const items = JSON.parse(JSON.stringify(this.items));

      if (this.editingNewItem) {
        items.pop();
        this.items = items;
        this.itemOpen = false;
        this.editingNewItem = false;
        this.editingItem = false;
      } else if (index === this.showItem) {
        items[index] = this.itemCopy;
        this.items = items;
        this.itemOpen = false;
        this.editingItem = false;
      }
    },

    async saveItem(index) {
      if (index !== this.showItem) return;

      const loginStore = useLoginStore();
      const config = useRuntimeConfig();
      const item = this.items[index];
      const form = this.formRefs[index];

      if (!this.validateFields(item)) {
        form?.reportValidity();
        return;
      }

      this.saveFlag = true;

      try {
        const res = await $fetch(
          this.editingNewItem ? "/cms/add-item" : "/cms/save-item",
          {
            method: "POST",
            headers: {
              Authorization:
                "Basic " +
                btoa(config.public.userName + ":" + config.public.userPass),
            },
            body: {
              email: loginStore.email,
              password: loginStore.password,
              item: this.items[index],
              schema: this.schema,
              table_id: this.tableId,
            },
          },
        );

        const items = JSON.parse(JSON.stringify(this.items));
        items[index] = res;

        this.items = items;
        this.itemOpen = false;
        this.editingItem = false;
        this.editingNewItem = false;
      } catch (err) {
        if (err.status === 401) {
          loginStore.logout();
          location.reload();
        }

        console.log(err);
      } finally {
        this.saveFlag = false;
      }
    },

    async saveSortOrder() {
      const loginStore = useLoginStore();
      const config = useRuntimeConfig();

      this.saveFlag = true;
      this.saveAllFlag = true;
      const items = JSON.parse(JSON.stringify(this.items));

      for (let [index, item] of items.entries()) {
        item.sortOrder = index.toString();
      }

      try {
        await $fetch("/cms/save-sort-order", {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              btoa(config.public.userName + ":" + config.public.userPass),
          },
          body: {
            email: loginStore.email,
            password: loginStore.password,
            items: items,
            schema: this.schema,
            table_id: this.tableId,
          },
        });

        this.itemOpen = false;
      } catch (err) {
        if (err.status === 401) {
          loginStore.logout();
          location.reload();
        }

        console.log(err);
      } finally {
        this.saveFlag = false;
        this.saveAllFlag = false;
      }
    },

    async addItems() {
      const loginStore = useLoginStore();
      const config = useRuntimeConfig();

      this.saveFlag = true;
      this.saveAllFlag = true;

      try {
        await $fetch("/cms/add-items", {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              btoa(config.public.userName + ":" + config.public.userPass),
          },
          body: {
            email: loginStore.email,
            password: loginStore.password,
            items: this.items,
            schema: this.schema,
            table_id: this.tableId,
          },
        });
      } catch (err) {
        if (err.status === 401) {
          loginStore.logout();
          location.reload();
        }

        console.log(err);
      } finally {
        this.itemOpen = false;
        this.saveFlag = false;
        this.saveAllFlag = false;
      }
    },

    async deleteItems() {
      const loginStore = useLoginStore();
      const config = useRuntimeConfig();

      this.saveFlag = true;
      this.saveAllFlag = true;

      try {
        await $fetch("/cms/delete-items", {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              btoa(config.public.userName + ":" + config.public.userPass),
          },
          body: {
            email: loginStore.email,
            password: loginStore.password,
            items: this.items,
            schema: this.schema,
            table_id: this.tableId,
          },
        });
      } catch (err) {
        if (err.status === 401) {
          loginStore.logout();
          location.reload();
        }

        console.log(err);
      } finally {
        this.itemOpen = false;
        this.saveFlag = false;
        this.saveAllFlag = false;
      }
    },

    async deleteItem(index) {
      const loginStore = useLoginStore();
      const config = useRuntimeConfig();
      this.saveFlag = true;

      try {
        await $fetch("/cms/delete-item", {
          method: "POST",
          headers: {
            Authorization:
              "Basic " +
              btoa(config.public.userName + ":" + config.public.userPass),
          },
          body: {
            email: loginStore.email,
            password: loginStore.password,
            item: this.items[index],
            schema: this.schema,
            table_id: this.tableId,
          },
        });

        const items = JSON.parse(JSON.stringify(this.items));
        items.splice(index, 1);
        this.items = items;
        this.itemOpen = false;
        this.editingItem = false;
      } catch (err) {
        if (err.status === 401) {
          loginStore.logout();
          location.reload();
        }

        console.log(err);
      } finally {
        this.saveFlag = false;
      }
    },

    validateFields(item) {
      for (const config of this.schema) {
        if (config.hidden) continue;
        if (!config.required) continue;

        const key = config.name;
        const value = item[key];

        if (value === undefined || value === null) {
          return false;
        }

        if (typeof value === "string" && value.trim() === "") {
          return false;
        }

        if (Array.isArray(value) && value.length === 0) {
          return false;
        }

        if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          if (!value.name && !value.file) {
            return false;
          }
        }

        if (config.type === "checkbox" && value === false) {
          return false;
        }
      }

      return true;
    },

    selectorYears(dateFieldPath = "date") {
      const items = this.items ?? [];

      return [
        ...new Set(
          items.map((item) => {
            const dateValue = dateFieldPath
              .split(".")
              .reduce((obj, key) => obj?.[key], item);

            if (Array.isArray(dateValue)) {
              return new Date(dateValue[0]).getFullYear();
            } else {
              return new Date(dateValue).getFullYear();
            }
          }),
        ),
      ].sort();
    },

    filteredSelectItems(dateFieldPath = "date") {
      const items = this.items ?? [];

      if (
        items.length === 0 ||
        this.selectorYears(dateFieldPath).length === 0
      ) {
        return items;
      }

      const selectedYear =
        this.selectedYear === "-"
          ? this.selectorYears(dateFieldPath)[0]
          : parseInt(this.selectedYear);

      const selectedMonth =
        this.selectedMonth === "-" ? 0 : months.indexOf(this.selectedMonth);

      const startDate = new Date(selectedYear, selectedMonth, 1);

      const endYear =
        this.selectedYear === "-"
          ? this.selectorYears(dateFieldPath)[
              this.selectorYears(dateFieldPath).length - 1
            ]
          : parseInt(this.selectedYear);

      const endMonth = this.selectedMonth === "-" ? 11 : selectedMonth;

      const endDate = new Date(endYear, endMonth + 1, 0, 23, 59, 59);

      return items.filter((item) => {
        const dateValue = dateFieldPath
          .split(".")
          .reduce((obj, key) => obj?.[key], item);

        if (Array.isArray(dateValue)) {
          const itemStartDate = new Date(dateValue[0]);
          const itemEndDate = new Date(dateValue[1]);
          return itemEndDate >= startDate && itemStartDate <= endDate;
        } else {
          const itemDate = new Date(dateValue);
          return itemDate >= startDate && itemDate <= endDate;
        }
      });
    },
  },
});
