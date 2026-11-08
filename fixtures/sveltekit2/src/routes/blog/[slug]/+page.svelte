<!--
@component
A post: its title and text from the page's data, its slug from the route's params.
-->
<script lang="ts">
import type { PageProps } from "./$types";
import { page } from "$app/state";

let { data }: PageProps = $props();
</script>

<article>
  <h1>{data.post.title}</h1>
  <p>{data.post.body}</p>
  <small data-testid="slug">Slug: {page.params.slug}</small>
  <a href="/blog">All posts</a>
</article>
