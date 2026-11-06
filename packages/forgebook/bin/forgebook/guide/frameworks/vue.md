In a Vue project, `Badge.vue` and `Badge.stories.ts`: the types from `@forgebook/vue`, the component by its default import,
a slot as the arg `#name` (`"#default": "Text"`) and an event as its listener (`onRemove`). Open a `.vue` file's script
with its TSDoc block: that comment is the component's.

```ts
import type { Meta, Story } from "@forgebook/vue";

import Badge from "./Badge.vue";

export default { title: "Data/Badge", component: Badge } satisfies Meta<typeof Badge>;

/** The label as most pages use it. */
export const Default: Story<typeof Badge> = { args: { label: "New" }, parameters: { main: true } };
```

<!-- more -->

The stories, the configuration and the rest of the adapter: `node_modules/@forgebook/vue/README.md`.
