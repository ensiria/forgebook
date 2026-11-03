<!--
@component
A decorator's component: the story inside a `section` that says which decorator it is.
-->
<script lang="ts">
import type { Snippet } from "svelte";

const { label, children }: { readonly label: string; readonly children?: Snippet } = $props();
</script>

<section data-decorator={label}>{@render children?.()}</section>
