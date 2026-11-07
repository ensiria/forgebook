In a Preact project, `Badge.tsx` and `Badge.stories.tsx`, the types from `@forgebook/preact`.

```tsx
import type { Meta, Story } from "@forgebook/preact";

import { Badge } from "./Badge";

export default { title: "Data/Badge", component: Badge } satisfies Meta<typeof Badge>;

/** The label as most pages use it. */
export const Default: Story<typeof Badge> = { args: { label: "New" }, parameters: { main: true } };
```

<!-- more -->

The stories, the configuration and the rest of the adapter: `node_modules/@forgebook/preact/README.md`.
