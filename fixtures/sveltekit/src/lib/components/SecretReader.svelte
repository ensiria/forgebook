<!--
@component
A component that reads a private variable, as only server code may: drawn in a catalogue, it fails to load rather than
put the secret in the page.
-->
<script lang="ts">
import { SECRET_API_TOKEN } from "$app/env/private";
</script>

<p>{SECRET_API_TOKEN}</p>
