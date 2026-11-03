<!--
  @component
  The cart's count, shared by every component through `useState`, its currency from a cookie, and a checkout that
  navigates away.
-->
<script setup lang="ts">
const count = useState<number>("cart", () => 0);
const currency = useCookie<string>("currency", { default: () => "USD" });

const add = (): void => {
  count.value += 1;
};

const checkout = async (): Promise<void> => {
  await navigateTo({ path: "/checkout", query: { items: String(count.value) } });
};
</script>

<template>
  <div>
    <button type="button" @click="add">Add to cart ({{ count }})</button>
    <span data-testid="currency">{{ currency }}</span>
    <button type="button" @click="checkout">Checkout</button>
  </div>
</template>
