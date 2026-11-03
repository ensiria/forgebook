# @forgebook/story-format

The story format of [Forgebook](https://www.npmjs.com/package/forgebook), as types: Component Story Format 3, generic
over a framework, and the `StorySource` a package hands a catalogue. It has no dependencies, so a component library's
stories depend on it and never on the catalogue that shows them.

**Requirements:** none: no dependencies, types and a few small helpers ·
[MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/story-format/LICENSE)

Most projects never install it themselves: `@forgebook/react` brings it, and its `Meta` and `Story` are this format
typed for React. A library installs it to publish its stories for other catalogues:

```ts
// stories.ts, exported by the library as "@acme/ui/stories"
/// <reference types="@forgebook/story-format/client" />
import type { StorySource } from "@forgebook/story-format/source";

import files from "./src/*.stories.tsx?forgebook-files";

export const source: StorySource = {
  id: "acme-ui",
  name: "Acme UI",
  files: [files],
  sheets: { required: [], theme: [], restyled: [] }
};
```

An app's `forgebook.config.ts` then lists it: `sources: ["@acme/ui/stories"]`.

| Import | What it is |
|---|---|
| `@forgebook/story-format/csf` | The CSF 3 types, generic over a framework |
| `@forgebook/story-format/source` | `StorySource`: a package's story files, style sheets, texts, home page and docs pages |
| `@forgebook/story-format/client` | The types of the `?forgebook-files`, `?forgebook-markdown` and `?forgebook-docs-pages` imports |
| `@forgebook/story-format/texts` | Texts inside the stories, by key, in the catalogue's language |
| `@forgebook/story-format/clock` | The story clock a live story reads |
| `@forgebook/story-format/testing-library` | `canvas` and `userEvent` in every `play`, once Testing Library is installed |

More: [Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).
