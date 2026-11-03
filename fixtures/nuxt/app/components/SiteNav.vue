<!--
  @component
  The site's navigation: Nuxt's links, the active one marked, the path it is on, and a link out of the site.
-->
<script setup lang="ts">
const route = useRoute();
const path = computed(() => route.path);
</script>

<template>
  <nav class="shop-nav" aria-label="Site">
    <NuxtLink to="/">Home</NuxtLink>
    <NuxtLink :to="{ name: 'blog-slug', params: { slug: 'hello-world' } }">First post</NuxtLink>
    <NuxtLink to="/about">About</NuxtLink>
    <NuxtLink to="https://nuxt.com" target="_blank">Nuxt</NuxtLink>
    <p data-testid="path">On {{ path }}</p>
  </nav>
</template>
