<!--
@component
A component that throws for one value, so a story shows its error can be changed back.
-->
<script lang="ts">
const { text = "" }: { /** What it shows; `boom` throws while drawing. */ readonly text?: string } = $props();
const shown = $derived.by(() => {
  if (text === "boom") throw new Error("Fragile broke");
  return text;
});
</script>

<p data-testid="fragile">{shown}</p>
