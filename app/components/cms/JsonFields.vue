<template>
  <template v-for="(field, fieldKey) in fields" :key="fieldKey">
    <CmsJsonFields
      v-if="isNestedObject(field)"
      :fields="field"
      :base-input="baseInput"
      :item="item"
      :item-data="getOrCreateNestedSection(fieldKey)"
      :index="index"
      :path="childPath(fieldKey)"
    />

    <CmsInputs
      v-else
      :input="buildInputConfig(fieldKey, field)"
      :item="itemData"
      :index="index"
    />
  </template>
</template>

<script>
import { staticContentTypes } from "~/../server/db/cmsConfig";

export default {
  name: "JsonFields",

  props: {
    fields: {
      type: Object,
      required: true,
    },
    baseInput: {
      type: Object,
      required: true,
    },
    item: {
      type: Object,
      required: true,
    },
    itemData: {
      type: Object,
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
    path: {
      type: String,
      default: "",
    },
  },

  methods: {
    isNestedObject(value) {
      return typeof value === "object" && value !== null;
    },

    buildInputConfig(fieldKey, fieldType) {
      const label = this.path ? `${this.path}.${fieldKey}` : fieldKey;
      return {
        ...this.baseInput,
        name: fieldKey,
        uniqueId: label,
        label,
        type: fieldType,
      };
    },

    getOrCreateNestedSection(fieldKey) {
      if (!this.itemData[fieldKey]) {
        const template = this.getTemplateForPath(fieldKey);
        if (template && typeof template === "object") {
          this.itemData[fieldKey] = Object.fromEntries(
            Object.keys(template).map((k) => [
              k,
              this.isNestedObject(template[k]) ? {} : "",
            ]),
          );
        } else {
          this.itemData[fieldKey] = {};
        }
      }
      return this.itemData[fieldKey];
    },

    getTemplateForPath(fieldKey) {
      let template = staticContentTypes[this.item.title];
      const pathParts = this.path ? this.path.split(".") : [];

      for (const part of pathParts) {
        template = template?.[part];
      }

      return template?.[fieldKey];
    },

    childPath(fieldKey) {
      return this.path ? `${this.path}.${fieldKey}` : fieldKey;
    },
  },
};
</script>
