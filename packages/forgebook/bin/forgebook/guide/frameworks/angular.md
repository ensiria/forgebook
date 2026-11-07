In an Angular or Analog project, `badge.component.ts` and `Badge.stories.ts`: the types and Storybook's helpers
(`applicationConfig`, `moduleMetadata`, `componentWrapperDecorator`, `argsToTemplate`) from `@forgebook/angular`, the
class by its name, an input or an output by the name a template binds (its alias), an output's arg a handler, projected
content as `#default` or `#<selector>` (`"#[icon]": "*"`), and a template in a render as
`({ props: args, template: "…" })`.

```ts
import type { Meta, Story } from "@forgebook/angular";

import { Badge } from "./badge.component";

export default { title: "Data/Badge", component: Badge } satisfies Meta<typeof Badge>;

/** The label as most pages use it. */
export const Default: Story<typeof Badge> = { args: { label: "New" }, parameters: { main: true } };
```

<!-- more -->

The Code tab writes the story by the component's selector.

The stories, the configuration and the rest of the adapter: `node_modules/@forgebook/angular/README.md`.
