<!--
@component
A button that flips, using `createToggle`: the scene of its story.
-->
<script lang="ts">
import { createToggle } from "./toggle.svelte";

const toggle = createToggle();
</script>

<button type="button" onclick={toggle.flip}>{toggle.isOn ? "On" : "Off"}</button>
