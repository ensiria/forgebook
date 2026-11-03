<!--
  @component
  The shop's products, from `useFetch` against the runtime config's API base, their prices written by a shared utility.
-->
<script setup lang="ts">
type Product = { readonly id: number; readonly name: string; readonly cents: number };

const config = useRuntimeConfig();
const { data: products, status } = useFetch<Product[]>(`${String(config.public["apiBase"])}/products`);
</script>

<template>
  <section aria-label="Products">
    <p v-if="status === 'pending'">Loading…</p>
    <ul v-else>
      <li v-for="product in products ?? []" :key="product.id">{{ product.name }}: {{ formatPrice(product.cents) }}</li>
    </ul>
  </section>
</template>
