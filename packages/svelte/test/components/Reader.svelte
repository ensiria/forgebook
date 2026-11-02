<!--
@component
Reads what the frame hands a story's components: a text of the shown language and the story's moment.
-->
<script lang="ts">
import { getStoryNow } from "../../src/clock.ts";
import { getStoryText } from "../../src/texts.ts";

const text = getStoryText();
const now = getStoryNow();
</script>

<p>{text("greeting.hello")} {now.current}</p>
