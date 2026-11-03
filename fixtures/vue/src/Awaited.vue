<script setup lang="ts">
/**
 * A component whose script awaits at its top level, which only a `Suspense` around it can draw.
 *
 * @module
 */
const text = await Promise.resolve("Awaited");
</script>

<template>
  <p data-testid="awaited">{{ text }}</p>
</template>
