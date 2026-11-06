With custom elements, `my-badge.ts` and `MyBadge.stories.ts`: the types from `@forgebook/web-components`, the element by
its tag (`component: "my-badge"`, the module imported for its definition) or its class. An arg's prefix says what it
sets: `label` the attribute, `.items` the property, `#icon` a slot (`#default` the unnamed one), `@change` an event the
catalogue records, which a render does not bind. A render returns a Lit template.

```ts
import type { Meta, Story } from "@forgebook/web-components";

import "./my-badge.ts";

export default { title: "Data/Badge", component: "my-badge" } satisfies Meta<"my-badge">;

/** The label as most pages use it. */
export const Default: Story<"my-badge"> = { args: { label: "New" }, parameters: { main: true } };
```

<!-- more -->

The props come from the package's `custom-elements.json`: run its analyzer after changing an element, or the docs show the old one.

The stories, the configuration and the rest of the adapter: `node_modules/@forgebook/web-components/README.md`.
