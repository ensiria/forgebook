<!--
@component
A short label that says what something is.
@useWhen a status needs a word
-->
<script lang="ts">
/**
 * The badge: a label, a tone and an optional icon.
 *
 * @module
 */
import type { Snippet } from "svelte";
import type { HTMLAttributes } from "svelte/elements";

import type { Tone } from "./tones.ts";

interface Props extends HTMLAttributes<HTMLSpanElement> {
  /** What it says. */
  label: string;
  /** Its colour. */
  tone?: Tone;
  /** How many, shown after the label. */
  count?: number;
  /** Whether a person can take it away. */
  removable?: boolean;
  /** Drawn before the label. */
  icon?: Snippet;
  /** Drawn after the label, with the count. */
  trailing?: Snippet<[count: number]>;
  /** The person took it away. */
  onremove?: (label: string) => void;
  /** The text a person typed, bound by the parent. */
  note?: string;
}

let {
  label,
  tone = "neutral",
  count = 0,
  removable = false,
  icon,
  trailing,
  onremove,
  note = $bindable(""),
  ...rest
}: Props = $props();
</script>

<span class="badge badge--{tone}" {...rest}>
  {@render icon?.()}{label} {count}{@render trailing?.(count)}
  {#if removable}<button type="button" onclick={() => onremove?.(label)}>Remove</button>{/if}
  <input bind:value={note} />
</span>
