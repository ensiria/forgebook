<!--
@component
A component that awaits at its top level: the frame draws it, and runs its play, once what it awaits has come.
-->
<script lang="ts">
const text = await new Promise<string>((resolve) => setTimeout(() => resolve("Awaited"), 50));
</script>

<p data-testid="awaited">{text}</p>
