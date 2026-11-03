<!--
  @component
  A post of the blog, fetched for the route's slug: `useRoute`'s params, `useAsyncData` with `$fetch`, a component and
  a utility the template uses without importing them.
-->
<script setup lang="ts">
type Post = { readonly title: string; readonly status: "draft" | "published" };

const route = useRoute();
const slug = String(route.params["slug"] ?? "");
const { data: post, error } = await useAsyncData<Post>(`post-${slug}`, () =>
  $fetch<Post>(`/api/posts/${slug}`)
);
</script>

<template>
  <article>
    <h2>{{ post?.title ?? titleOfSlug(slug) }}</h2>
    <BaseBadge v-if="post" :label="post.status" :tone="post.status === 'published' ? 'success' : 'neutral'" />
    <p v-if="error" role="alert">The post could not be loaded ({{ error.statusCode }})</p>
  </article>
</template>
