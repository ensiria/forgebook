<script setup lang="ts">
/**
 * A component that throws for one value, so a story shows its error can be changed back.
 *
 * @module
 */
import { computed } from "vue";

const props = defineProps<{
  /** What it shows; `boom` throws while drawing. */
  text?: string;
}>();
const shown = computed(() => {
  if (props.text === "boom") throw new Error("Fragile broke");
  return props.text;
});
</script>

<template>
  <p data-testid="fragile">{{ shown }}</p>
</template>
