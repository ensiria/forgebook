<script setup>
defineProps({
  /** The tile's text. */
  text: { type: String, required: true }
});
</script>

<template>
  <i>{{ text }}</i>
</template>
