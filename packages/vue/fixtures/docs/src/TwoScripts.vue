<script lang="ts">
export const SHARED = 1;
</script>

<script setup lang="ts">
const emit = defineEmits<{
  /** The person picked it. */
  pick: [];
}>();
</script>

<template>
  <button type="button" @click="emit('pick')">{{ SHARED }}</button>
</template>
