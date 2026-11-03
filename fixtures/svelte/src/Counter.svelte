<!--
@component
A button that counts its clicks under a label: state of its own, which new args must keep.
-->
<script lang="ts">
const { label = "Clicks" }: { /** What it counts. */ readonly label?: string } = $props();
let clicks = $state(0);
</script>

<button type="button" data-testid="counter" onclick={() => (clicks += 1)}>{label}: {clicks}</button>
