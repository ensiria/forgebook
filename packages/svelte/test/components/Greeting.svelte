<!--
@component
The adapter suite's subject: a greeting that counts its clicks in its own state, and throws while drawn for one name.
-->
<script lang="ts">
import { THROWING_NAME } from "@forgebook/testing/conformance";

const { name }: { readonly name: string } = $props();
let clicks = $state(0);
const greeting = $derived.by(() => {
  if (name === THROWING_NAME) throw new Error("No greeting");
  return `Hello ${name} ${clicks}`;
});
</script>

<button type="button" onclick={() => (clicks += 1)}>{greeting}</button>
