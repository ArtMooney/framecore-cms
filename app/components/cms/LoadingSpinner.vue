<template>
  <div
    class="animate-[spin_0.6s_linear_infinite] rounded-full border-[3px]"
    :class="[
      size === 'large' ? 'h-10 w-10' : 'h-5 w-5',
      mode === 'dark'
        ? 'border-white/20 border-t-white'
        : 'border-black/20 border-t-black',
    ]"
  ></div>
</template>

<script>
export default {
  name: "LoadingSpinner",

  props: {
    size: {
      type: String,
      required: false,
      default: "default",
    },
    mode: {
      type: String,
      required: false,
      default: "dark",
    },
  },
};
</script>
