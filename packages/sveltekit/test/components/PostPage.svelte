<!--
@component
A page as SvelteKit draws one: its data and form as props, its route from `page`, a link to another post, a form.
-->
<script lang="ts">
import { enhance } from "../../src/app/forms.ts";
import { afterNavigate } from "../../src/app/navigation.ts";
import { page } from "../../src/app/state.ts";

type Props = { data: { readonly title?: string }; form?: { readonly message?: string } | null };

let { data, form = null }: Props = $props();
let navigations = $state(0);

afterNavigate(() => {
  navigations += 1;
});
</script>

<h1>{data.title}</h1>
<p data-testid="route">{page.route.id} {page.params["slug"] ?? ""} {page.url.pathname}</p>
<p data-testid="navigations">{navigations}</p>
<a href="/blog/second">Second</a>
<a href="https://example.com/away">Away</a>
<form method="POST" action="?/save" use:enhance>
  <input name="title" value="Draft" />
  <button type="submit">Save</button>
</form>
<form method="GET" action="/blog/search"><input name="q" value="kit" /><button type="submit">Find</button></form>
<svg><a href="/blog/drawn"><text>Drawn</text></a></svg>
<p data-testid="form">{form?.message ?? ""}</p>
