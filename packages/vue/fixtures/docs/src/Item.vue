<script lang="ts">
/** A row of a list of badges. */
export default { name: "BadgeItem" };
</script>

<script setup lang="ts">
defineProps<{
  /** The row's text. */
  text: string;
}>();
</script>

<template>
  <li>{{ text }}</li>
</template>
