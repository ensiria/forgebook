In a Next.js project (`framework: nextjs()`), stories take their types from `@forgebook/nextjs`. A story says where its component
is with `parameters.nextjs.navigation` (`pathname`, `query`, `params`; `router` for the Pages Router), and what its server
code reads with `nextjs.cookies`, `headers` and `draftMode`.

```tsx
import type { Meta, Story } from "@forgebook/nextjs";

import { Badge } from "./Badge";

export default { title: "Data/Badge", component: Badge } satisfies Meta<typeof Badge>;

/** The label as most pages use it. */
export const Default: Story<typeof Badge> = { args: { label: "New" }, parameters: { main: true } };
```

<!-- more -->

A link or a router call moves the story's route and is listed among its events; a `play` reads where it went with `storyRoute()`
(`@forgebook/nextjs/route`). Async server components are drawn; what they reach on a server (a database, the file
system) is not there: fetch it and mock it with `parameters.msw`. In the server tests a server component's `fetch` never
reaches the network, whatever its address: a fetch no handler answers fails the story, naming the address.

The stories, the configuration and the rest of the adapter: `node_modules/@forgebook/nextjs/README.md`.
