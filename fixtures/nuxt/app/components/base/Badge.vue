<!--
  @component
  A small label, named `BaseBadge` by its folder, as Nuxt names a component in `components/base/`.
-->
<script setup lang="ts">
withDefaults(defineProps<{ readonly label: string; readonly tone?: "neutral" | "success" | "danger" }>(), {
  tone: "neutral"
});
</script>

<template>
  <span class="base-badge" :data-tone="tone">{{ label }}</span>
</template>

<style scoped>
.base-badge {
  padding: 0 6px;
  border-radius: 999px;
  border: 1px solid currentColor;
  font-size: 12px;
}

.base-badge[data-tone="success"] {
  color: #15803d;
}

.base-badge[data-tone="danger"] {
  color: #b91c1c;
}
</style>
