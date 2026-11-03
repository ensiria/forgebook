<!--
@component
Throws once it is mounted: drawn, then failed.
-->
<script lang="ts">
import { onMount } from "svelte";

onMount(() => {
  throw new Error("Thrown on mount");
});
</script>

<p>Mounted</p>
