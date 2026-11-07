With no framework, `button.ts` and `button.stories.ts`: the types from `@forgebook/html`, the meta's `component` the
function that draws (`createButton(args)`, returning an HTML string or a DOM node), so the args are its first parameter,
documented by that type's TSDoc; a story without a render calls it with the args.

```ts
import type { Meta, Story } from "@forgebook/html";

import { createButton } from "./button";

export default { title: "Data/Button", component: createButton } satisfies Meta<typeof createButton>;

/** The label as most pages use it. */
export const Default: Story<typeof createButton> = { args: { label: "Save" }, parameters: { main: true } };
```

<!-- more -->

A story that only has a render types it with `Meta<ButtonArgs>`, or describes its args
in `argTypes` (plain JavaScript). A text arg written into HTML is the story's to escape; a shared link hands it only
plain words.

The stories, the configuration and the rest of the adapter: `node_modules/@forgebook/html/README.md`.
