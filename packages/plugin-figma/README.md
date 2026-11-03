# @forgebook/plugin-figma

A story's design in [Forgebook](https://www.npmjs.com/package/forgebook)'s panel, embedded from Figma, and beside the story.

**Requirements:** `forgebook` · [MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/plugin-figma/LICENSE)

```sh
npm install --save-dev @forgebook/plugin-figma
```

```ts
// forgebook.config.ts
import { figma } from "@forgebook/plugin-figma";

export default defineConfig({ /* … */ plugins: [figma()] });
```

A story with `parameters.design.figma` then has a **Design** tab. It loads, with Figma's viewer, only when opened. Forgebook
reads the link without this plugin, so the component's header button and the agents' answers need nothing more; see
[Design links](https://github.com/ensiria/forgebook/tree/develop/packages/forgebook#design-links).

The tab's id is `figma` (`?tab=figma`, `tabs: { figma: false }`). A docs page shows a design with a `figma` fence, its link after the
name and the design's name inside.

A catalogue replaces the tab's name (`strings: { "tabs.figma": "Figma" }`) and its texts by `plugin.figma.<key>`: `open`,
`loading`, `frame`, `compare`, `compareTitle`, `close`, `note`, `storyPane`, `designPane`.
