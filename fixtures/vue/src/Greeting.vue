<script setup lang="ts">
/**
 * A greeting in the shown language, at the story clock's time.
 *
 * @module
 */
import { useStoryNow } from "@forgebook/vue/clock";
import { useStoryText } from "@forgebook/vue/texts";

const text = useStoryText();
const now = useStoryNow();
</script>

<template>
  <p data-testid="greeting">{{ text("greeting.hello") }} {{ new Date(now).toISOString() }}</p>
</template>
