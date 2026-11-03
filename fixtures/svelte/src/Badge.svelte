<!--
@component
A short label beside a thing, in one of a few tones.
@useWhen A count or a state beside a title.
-->
<script lang="ts">
/**
 * The badge: a label, a tone, a count and two snippets.
 *
 * @module
 */
import type { Snippet } from "svelte";

import type { Tone } from "./tones";

type Props = {
  /** The text it shows. */
  label: string;
  /** What it says about the label. */
  tone?: Tone;
  /** Whether it stands out less. */
  quiet?: boolean;
  /** How many it counts. */
  count?: number;
  /** What goes before the label. */
  icon?: Snippet;
  /** What goes after it. */
  children?: Snippet;
  /** The person took it away. */
  onremove?: (label: string) => void;
};

const { label, tone = "neutral", quiet = false, count = 0, icon, children, onremove }: Props = $props();
</script>

<span class="badge badge--{tone}" data-quiet={quiet}>
  {@render icon?.()}
  {label}
  {#if count > 0}<b data-testid="count">{count}</b>{/if}
  {@render children?.()}
  <button type="button" aria-label="Remove" onclick={() => onremove?.(label)}>x</button>
</span>

<style>
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
