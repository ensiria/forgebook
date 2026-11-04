<!--
  @component
  The site's header: the app config's title, a greeting from an auto-imported composable, and imports through Nuxt's
  aliases (`#components`, `~`, the config's `#money`).
-->
<script setup lang="ts">
import { BaseBadge } from "#components";
import { formatPrice as price } from "#money";
import { titleOfSlug as titleOf } from "~/utils/slug";

const appConfig = useAppConfig();
const greeting = useGreeting("Ada");

/** A value of the app config's theme: `nuxt.config`'s and `app.config.ts`'s, merged. */
const themeValue = (name: string): string => {
  const theme = appConfig["theme"];
  return typeof theme === "object" && theme !== null && name in theme ? String(Reflect.get(theme, name)) : "";
};
</script>

<template>
  <header :data-accent="themeValue('accent')" :data-radius="themeValue('radius')">
    <h1>{{ appConfig["title"] }}</h1>
    <p>{{ greeting }}</p>
    <BaseBadge :label="`Free shipping over ${price(5000)}`" tone="success" />
    <small>{{ titleOf("new-arrivals") }}</small>
  </header>
</template>
