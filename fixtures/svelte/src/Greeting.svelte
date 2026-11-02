<!--
@component
A greeting in the shown language, at the story clock's time.
-->
<script lang="ts">
import { getStoryNow } from "@forgebook/svelte/clock";
import { getStoryText } from "@forgebook/svelte/texts";

const text = getStoryText();
const now = getStoryNow();
</script>

<p data-testid="greeting">{text("greeting.hello")} {new Date(now.current).toISOString()}</p>
