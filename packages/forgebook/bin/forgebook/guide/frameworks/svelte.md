In a Svelte project, `Badge.svelte` and `Badge.stories.ts`: the types from `@forgebook/svelte`, the component by its default
import, a snippet's text as the arg `#name` (`"#children": "Text"`), a callback prop as it is (`onremove`), and a render
returning `{ Component, props }`. The `<!-- @component -->` comment is the component's.

```ts
import type { Meta, Story } from "@forgebook/svelte";

import Badge from "./Badge.svelte";

export default { title: "Data/Badge", component: Badge } satisfies Meta<typeof Badge>;

/** The label as most pages use it. */
export const Default: Story<typeof Badge> = { args: { label: "New" }, parameters: { main: true } };
```

<!-- more -->

The stories, the configuration and the rest of the adapter: `node_modules/@forgebook/svelte/README.md`.
