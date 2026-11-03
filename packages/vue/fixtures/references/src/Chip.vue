<script setup lang="ts">
defineProps<{
  /** The chip's text. */
  text: string;
}>();
</script>

<template>
  <b>{{ text }}</b>
</template>
