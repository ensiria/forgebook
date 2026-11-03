<script setup lang="ts">
/**
 * A short label beside a thing.
 *
 * @remarks
 * Stays on one line.
 *
 * @useWhen A count or a state beside a title.
 * @avoidWhen The text is a sentence.
 * @alternatives `Tag`, `Pill`
 * @module
 */
import { computed } from "vue";

import type { Tone } from "./tones.ts";

/** Badge's props. */
export type BadgeProps = {
  /** The text it shows. */
  label: string;
  /**
   * What it says about the label.
   *
   * @defaultValue "neutral"
   */
  tone?: Tone;
  /** How large it is. */
  size?: "xl" | "sm";
  /** Whether it stands out less. */
  quiet?: boolean;
  /** How many it counts. */
  count?: number;
  /** Anything else. */
  meta?: Readonly<Record<string, string>>;
};

const props = withDefaults(defineProps<BadgeProps>(), { count: 3, quiet: false });
const emit = defineEmits<{
  /** The person took it away. */
  remove: [id: string, force: boolean];
}>();
const model = defineModel<string>("note");
defineSlots<{
  /** What goes after the label. */
  default: (scope: { label: string }) => unknown;
  /** What goes before it. */
  icon?: () => unknown;
}>();
const shown = computed(() => `${props.label} ${model.value ?? ""}`);
</script>

<template>
  <span @click="emit('remove', props.label, true)">
    <slot name="icon" />
    {{ shown }}
    <slot :label="shown" />
  </span>
</template>
