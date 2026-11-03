<!--
@component
The account page: a sign-in form enhanced by SvelteKit, its action's answer shown under it.
-->
<script lang="ts">
import type { PageProps } from "./$types";
import { enhance } from "$app/forms";
import { page } from "$app/state";

let { form }: PageProps = $props();
</script>

<form method="POST" action="?/signIn" use:enhance>
  <label>Email <input name="email" type="email" /></label>
  <button type="submit">Sign in</button>
</form>
{#if form?.message}
  <p role="status" data-testid="answer">{form.message} ({page.status})</p>
{/if}
