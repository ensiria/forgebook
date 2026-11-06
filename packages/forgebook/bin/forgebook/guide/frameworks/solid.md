In a Solid project, `Badge.tsx` and `Badge.stories.tsx`, the types from `@forgebook/solid`. A render runs once: read the args
inside its JSX (`<Badge label={args.label} />`) or spread them (`<Badge {...args} />`), never destructured, so a new
value reaches the story without starting it over.

```tsx
import type { Meta, Story } from "@forgebook/solid";

import { Badge } from "./Badge";

export default { title: "Data/Badge", component: Badge } satisfies Meta<typeof Badge>;

/** The label as most pages use it. */
export const Default: Story<typeof Badge> = { args: { label: "New" }, parameters: { main: true } };
```

<!-- more -->

The stories, the configuration and the rest of the adapter: `node_modules/@forgebook/solid/README.md`.
