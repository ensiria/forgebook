<!--
@component
Where to write for help, from `$env/dynamic/public`, reached through the app's own `$ui` alias.
-->
<script lang="ts">
import { env } from "$env/dynamic/public";

let { topic = "a question" }: { topic?: string } = $props();
</script>

<a data-testid="support" href="mailto:{env.PUBLIC_SUPPORT_EMAIL}">Write to {env.PUBLIC_SUPPORT_EMAIL} about {topic}</a>
