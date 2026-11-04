<!--
@component
The preview's wrapper around every story, which says the shown language.
-->
<script lang="ts">
import type { Snippet } from "svelte";

const { lang, children }: { readonly lang: string; readonly children?: Snippet } = $props();
</script>

<div data-testid="preview" data-lang={lang}>{@render children?.()}</div>
