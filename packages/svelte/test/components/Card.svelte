<!--
@component
A card with a title, a header snippet and its content.
-->
<script lang="ts">
import type { Snippet } from "svelte";

const {
  title = "",
  header,
  children
}: { readonly title?: string; readonly header?: Snippet; readonly children?: Snippet } = $props();
</script>

<article><h1>{title}</h1><header>{@render header?.()}</header><main>{@render children?.()}</main></article>
