<!--
@component
A search box that goes to `/search?q=…` with `goto`, shows the query of the page it is on and counts the navigations
it saw with `afterNavigate`; an empty query is stopped by `beforeNavigate`.
-->
<script lang="ts">
import { afterNavigate, beforeNavigate, goto } from "$app/navigation";
import { page } from "$app/state";

let query = $state("");
let navigations = $state(0);

afterNavigate(() => {
  navigations += 1;
});

beforeNavigate((navigation) => {
  if (navigation.to?.url.searchParams.get("q") === "") navigation.cancel();
});

const search = async (event: SubmitEvent): Promise<void> => {
  event.preventDefault();
  await goto(`/search?q=${encodeURIComponent(query)}`);
};
</script>

<form role="search" onsubmit={search}>
  <label>Search <input name="q" bind:value={query} /></label>
  <button type="submit">Search</button>
</form>
<p data-testid="query">Query: {page.url.searchParams.get("q") ?? "none"}</p>
<p data-testid="navigations">Navigations: {navigations}</p>
