In a SvelteKit app (`framework: sveltekit()`), `Badge.svelte` and `Badge.stories.ts`, the types from `@forgebook/sveltekit`. A story sets the page its components read with `parameters.sveltekit`:
`page: { url: "/blog/hello" }` (the route and params are read from `src/routes`), `page.data` or the page's own `load`, and `forms.result`.
A component that imports `$app/env/private` or `$app/server` fails in its frame by design: give it what it reads instead.

```ts
import type { Meta, Story } from "@forgebook/sveltekit";

import Badge from "./Badge.svelte";

export default { title: "Data/Badge", component: Badge } satisfies Meta<typeof Badge>;

/** The label as most pages use it. */
export const Default: Story<typeof Badge> = { args: { label: "New" }, parameters: { main: true } };
```

<!-- more -->

The page's `load` runs before the story is drawn, its fetch answered by
`parameters.msw` in the frame and in the server tests, where a fetch of the page's origin that no handler answers
fails the story; `forms.result` is what an enhanced form's action answers. Links and `goto` move the story's page and are listed among
its events; in a play, `storyPage()` from `@forgebook/sveltekit/page` reads where it went and the calls it made.

The stories, the configuration and the rest of the adapter: `node_modules/@forgebook/sveltekit/README.md`.
