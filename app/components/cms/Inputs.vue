<script setup>
import { VueDatePicker } from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";
import sv from "date-fns/locale/sv";
import IconCloseCircleOutline from "~icons/ion/close-circle-outline";
</script>

<template>
  <div v-if="!input.hidden" class="flex flex-col gap-1">
    <p class="font-semibold text-white/50 italic">
      {{ input.label }}
    </p>

    <input
      v-if="
        input.type !== 'textarea' &&
        input.type !== 'file' &&
        input.type !== 'fileImg' &&
        input.type !== 'date' &&
        input.type !== 'dateRange' &&
        input.type !== 'select'
      "
      @click.stop
      v-model="item[input.name]"
      :type="input.type"
      :name="input.name"
      autocomplete="off"
      :required="input.required"
    />

    <VueDatePicker
      v-if="input.type === 'date' || input.type === 'dateRange'"
      v-model="item[input.name]"
      :formats="{ input: 'yyyy-MM-dd' }"
      :locale="sv"
      auto-apply
      :input-attrs="{ name: input.name, required: input.required }"
      :range="input.type === 'dateRange'"
      class="[&_div]:font-body! [&_input]:font-body! [&_button]:p-0! [&_div]:text-xs! [&_input]:border-white/25! [&_input]:bg-transparent! [&_input]:py-3! [&_input]:text-sm! [&_input]:text-white!"
    >
    </VueDatePicker>

    <textarea
      v-if="input.type === 'textarea'"
      @click.stop
      v-model="item[input.name]"
      :name="input.name"
      autocomplete="off"
      :required="input.required"
    ></textarea>

    <div
      v-if="input.type === 'file' || input.type === 'fileImg'"
      class="my-1 flex items-center justify-between gap-1 justify-self-start"
    >
      <input
        @click.stop
        @change="handleFileInput($event, input.name, item)"
        :id="`${inputId}-${index}`"
        :ref="`${inputId}-${index}`"
        class="hidden"
        type="file"
        :name="`${input.name}`"
        :accept="input.type === 'fileImg' ? '.jpg, .jpeg, .png, .webp' : ''"
        autocomplete="off"
        :required="input.required"
      />

      <label
        @click.stop
        :for="`${inputId}-${index}`"
        class="relative m-0 cursor-pointer p-0 text-sm underline"
      >
        <span class="max-w-xs truncate sm:max-w-md">
          {{ fileInputText(item, input) }}
        </span>

        <NuxtImg
          v-if="
            item[input?.name] &&
            input.type === 'fileImg' &&
            typeof item[input?.name] === 'string'
          "
          :src="`cms-files/${item[input.name]}`"
          alt="an image slot with an image selected by the user"
          class="h-20 min-h-20 w-20 min-w-20 object-cover"
          sizes="80px"
          densities="x1"
          format="webp"
        />

        <IconCloseCircleOutline
          v-if="isCloseIcon"
          @click.stop.prevent="removeFile(`${inputId}-${index}`, input.name)"
          class="absolute -top-3 -right-6 h-6 min-h-6 w-6 min-w-6 cursor-pointer px-0.5 text-white"
        ></IconCloseCircleOutline>
      </label>
    </div>

    <select
      v-if="input.type === 'select'"
      :name="input.name"
      v-model="selectValue"
      :required="input.required"
    >
      <option v-for="option in input.select_options" :value="option.value">
        {{ option.value }}
      </option>
    </select>
  </div>
</template>

<script>
export default {
  name: "Inputs",

  props: {
    input: {
      type: Object,
      required: true,
    },
    item: {
      type: Object,
      required: true,
    },
    index: {
      type: Number,
      required: true,
    },
  },

  computed: {
    inputId() {
      return this.input.uniqueId || this.input.name;
    },

    selectValue: {
      get() {
        return this.item[this.input.name] || "";
      },
      set(newValue) {
        this.item[this.input.name] = newValue;
      },
    },
  },

  data() {
    return {
      isCloseIcon: false,
    };
  },

  methods: {
    async handleFileInput(event, name, item) {
      if (!event.target.files[0].name) return;

      const { base64, contentType } = await this.readEncodeFiles(
        event.target.files,
      );

      item[name] = [
        {
          name: event.target.files[0].name,
          file: base64,
          contentType,
        },
      ];
    },

    readEncodeFiles(files) {
      return new Promise((resolve, reject) => {
        if (files.length > 0) {
          let selectedFile = files[0];
          let reader = new FileReader();

          reader.onload = function (e) {
            let dataUrl = e.target.result;
            let contentType = dataUrl.split(";")[0].split(":")[1];
            let base64Data = dataUrl.split(",")[1];
            resolve({ base64: base64Data, contentType });
          };

          reader.onerror = function (error) {
            reject(error);
          };

          reader.readAsDataURL(selectedFile);
        } else {
          reject(new Error("No files to process."));
        }
      });
    },

    fileInputText(item, input) {
      const filename = item[input?.name];
      const inputType = input.type;
      const isObject = typeof filename === "object";

      if (filename && !isObject) {
        this.isCloseIcon = true;

        if (inputType === "fileImg") {
          return "";
        }

        return filename;
      }

      if (filename && isObject && filename[0]?.name) {
        this.isCloseIcon = true;
        return filename[0]?.name;
      }

      this.isCloseIcon = false;
      return inputType === "file"
        ? "Click here to choose a file."
        : "Click here to choose an image.";
    },

    removeFile(inputName, fieldName) {
      this.$refs[inputName].value = "";
      this.item[fieldName] = "";
    },
  },
};
</script>
