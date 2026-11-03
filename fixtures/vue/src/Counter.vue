<script setup lang="ts">
/**
 * A count a person moves, which keeps its own state while its label changes.
 *
 * @module
 */
import { ref } from "vue";

defineProps<{
  /** What it counts. */
  label?: string;
}>();
const clicks = ref(0);
</script>

<template>
  <button type="button" data-testid="counter" @click="clicks += 1">{{ label }}: {{ clicks }}</button>
</template>
