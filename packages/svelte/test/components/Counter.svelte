<!--
@component
A button that counts its clicks in its own state, under a label from its props.
-->
<script lang="ts">
const { label = "" }: { readonly label?: string } = $props();
let clicks = $state(0);
</script>

<button type="button" onclick={() => (clicks += 1)}>{label} {clicks}</button>
