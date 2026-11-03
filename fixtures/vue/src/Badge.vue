<script setup lang="ts">
/**
 * A short label beside a thing, in one of a few tones.
 *
 * @remarks
 * Stays on one line.
 *
 * @useWhen A count or a state beside a title.
 * @module
 */
import type { Tone } from "./tones";

/** Badge's props. */
export type BadgeProps = {
  /** The text it shows. */
  label: string;
  /** What it says about the label. */
  tone?: Tone;
  /** Whether it stands out less. */
  quiet?: boolean;
  /** How many it counts. */
  count?: number;
};

withDefaults(defineProps<BadgeProps>(), { tone: "neutral", count: 0 });
const emit = defineEmits<{
  /** The person took it away. */
  remove: [label: string];
}>();
defineSlots<{
  /** What goes after the label. */
  default?: () => unknown;
  /** What goes before it. */
  icon?: () => unknown;
}>();
</script>

<template>
  <span class="badge" :class="`badge--${tone}`" :data-quiet="quiet">
    <slot name="icon" />
    {{ label }}
    <b v-if="count > 0" data-testid="count">{{ count }}</b>
    <slot />
    <button type="button" aria-label="Remove" @click="emit('remove', label)">x</button>
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e8eaf0;
  color: #1a1c24;
}

.badge--danger {
  background: #8f1d1d;
  color: #fff;
}

.badge--info {
  background: #1b4f9c;
  color: #fff;
}
</style>
