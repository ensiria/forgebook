# @forgebook/sveltekit

SvelteKit for [Forgebook](https://www.npmjs.com/package/forgebook): a SvelteKit app's components and pages drawn in a
catalogue, with what they read of the app (`$app/state`, `$app/navigation`, `$app/forms`, `$app/paths`, `$app/env`,
the public environment, `$lib` and a page's `load`) given by each story. Built on
[`@forgebook/svelte`](https://www.npmjs.com/package/@forgebook/svelte), on Vite.

**Requirements:** SvelteKit 2 or 3 · Svelte 5.46 · `forgebook` · Vite 8 · React in the project, for the catalogue's own
interface (the frames that draw your components load none) ·
[MIT licence](https://github.com/ensiria/forgebook/blob/develop/packages/sveltekit/LICENSE)

```sh
npm install --save-dev forgebook @forgebook/sveltekit react react-dom
```

The catalogue's configuration names it as its framework, beside the app's `vite.config`:

```ts
// forgebook.config.ts
import { sveltekit } from "@forgebook/sveltekit/vite";
import { defineConfig } from "forgebook";

export default defineConfig({ framework: sveltekit(), title: "My app", stories: ["src/**/*.stories.ts"] });
```

It reads SvelteKit's options where SvelteKit keeps them (the `sveltekit()` plugin of `vite.config` in SvelteKit 3,
`svelte.config.js` in SvelteKit 2), Svelte's options with them, and keeps the app's other Vite plugins (Tailwind CSS, an
i18n compiler), so a component is drawn as the app draws it. `vite.config` is read as `vite dev` reads it, for a
catalogue's build too, so the app's plugins run there: `keepPlugin` leaves out one only an app's build needs (a
source-map upload, a service-worker generator). `sveltekit({ dir, viteConfig, keepPlugin })` names another folder or
configuration; `viteConfig: false` reads only `svelte.config.js`.

## A story on a page

A story says which page its components are on, under `parameters.sveltekit`:

```ts
import type { Meta, Story } from "@forgebook/sveltekit";

import SiteNav from "./SiteNav.svelte";

export default { title: "Layout/Site nav", component: SiteNav } satisfies Meta<typeof SiteNav>;

// `page.url` from $app/state, the route `/blog/[slug]` and `page.params.slug` read from src/routes
export const OnAPost: Story<typeof SiteNav> = { parameters: { sveltekit: { page: { url: "/blog/hello" } } } };
```

A page is a story too, its data given or loaded as SvelteKit loads it:

```ts
import { http, HttpResponse } from "msw";

import Post from "./+page.svelte";
import { load } from "./+page";

export default { title: "Pages/Post", component: Post } satisfies Meta<typeof Post>;

// the page's own load, run in the frame with the story's params; its fetch answered by the story's mock
export const Loaded: Story<typeof Post> = {
  parameters: {
    sveltekit: { page: { url: "/blog/hello" }, load },
    msw: { handlers: [http.get("/api/posts/:slug", () => HttpResponse.json({ title: "Hello" }))] }
  }
};

// or the data as it is, what a server load would have returned
export const Given: Story<typeof Post> = {
  parameters: { sveltekit: { page: { url: "/blog/hello", data: { post: { title: "Hello" } } } } }
};
```

| `parameters.sveltekit` | What it sets |
|---|---|
| `page.url` | The page's address, from the base path (`/blog/hello?tab=1`); the route and params are read from `src/routes`. `/` by default |
| `page.route`, `page.params` | The route id and params, over what the address gives; a route id with params and no `url` gives the address |
| `page.data`, `page.form`, `page.state`, `page.status`, `page.error` | The rest of `page` |
| `load` | The page's universal `load` (or a list, the layouts' first): run before the story is drawn, again after each move and on `invalidate` |
| `serverData` | What the page's server load returned: the `data` its `load` receives, or the page's data without one |
| `navigating`, `updated` | What `navigating` and `updated.current` hold |
| `navigation`, `forms.enhance`, `hrefs` | Callbacks, as Storybook's SvelteKit names them: called with `goto`'s (and the others') arguments; a link whose href `hrefs` entries match (by key, or as a regular expression with `asRegex`) calls each of them instead of moving |
| `forms.result` | What an enhanced form's action answers (`{ type: "failure", status: 400, data }`); a success by default |

`load` takes the page's own `load`, typed by its `./$types`; one written in the story types its event itself
(`satisfies PageLoad`). A story that gives page data (`page.data`, `serverData`, `load`) or an action's answer
(`forms.result`) is a page's: its
component gets `data`, `form` and `params` as SvelteKit gives a `+page.svelte` them, unless its args set them. Storybook's
`sveltekit_experimental` is read too (`state.page`, `stores.page`, `navigation`, `forms`, `hrefs`), so stories moved
with `forgebook init --from storybook` keep their pages.

## What a story's page does

The page really moves, in SvelteKit's order: a link of the app clicked in a story, a GET form, `goto` and a redirect a
load throws run `beforeNavigate` (which may cancel), load the page's data, run `onNavigate`, change `page.url`, its route
and params, and run `afterNavigate`. A move a later one overtook is dropped; an error a load throws is the page's, shown
in place of the story. The frame's address never changes: every link (an SVG one and an `<area>` too) and every form is
caught, and one outside the app (another origin, or outside the base path) goes nowhere. One frame shows one page: a
story drawn several times at once (a matrix) shares it. Each move and each call
(`link`, `goto`, `invalidate`, `invalidateAll`, `refreshAll`, `pushState`, `preloadData`, `enhance`…) is listed in the
panel's Events. A play reads where the story went:

```ts
import { storyPage } from "@forgebook/sveltekit/page";

export const GoesToAbout: Story<typeof SiteNav> = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("link", { name: "About" }));
    // storyPage().pathname is "/about"; storyPage().calls lists the link
  }
};
```

An enhanced form (`use:enhance`) is sent to no server: the story's `forms.result` is the answer, and `page.form`, the
status and the form's `form` prop follow it as `applyAction` sets them, a success loads the page's data again; the
function `use:enhance` takes runs as in the app. A POST form without `use:enhance` is only listed among the events.

| Module | In a story |
|---|---|
| `$app/state`, `$app/stores` | The story's page, followed by Svelte; the stores for SvelteKit 2 |
| `$app/navigation` | `goto`, `invalidate`, `invalidateAll`, `refreshAll`, `preloadData`, `preloadCode`, `pushState`, `replaceState`, the three navigation callbacks; `disableScrollHandling` and `snapshot` do nothing |
| `$app/forms` | `enhance`, `applyAction`, `deserialize` (JSON) |
| `$app/paths` | `base`, `assets`, `asset`, `resolve`, `resolveRoute`, `match`, from the app's `paths` and routes |
| `$app/env`, `$app/environment` | `browser` (false in a server test), `dev`, `building` (false), `version` |
| `$app/manifest` | The routes and the static files |
| `$app/env/public` (SvelteKit 3) | The variables `src/env.ts` declares public, checked by their schema (one with none must be set) |
| `$env/static/public`, `$env/dynamic/public` (SvelteKit 2) | The variables with the public prefix, from the environment and the `.env` files, fixed when a static build is made |
| `$lib`, the `alias` option | As SvelteKit resolves them; SvelteKit 3's `#lib` is the app's own `imports` |
| `$app/env/private`, `$env/*/private`, `$app/server`, `$service-worker` | Refused: the story fails with why, and the value never reaches the page |
| The other SvelteKit's environment | Refused too: SvelteKit 3 has no `$env/*`, so no variable reaches its page by its prefix alone; SvelteKit 2 has no `$app/env/public` |

Generated server tests take `kitRenderer` from `@forgebook/sveltekit/renderer`: a page's `load` runs first, its relative
`fetch` read from the story's page. They answer no fetch, so a story whose load fetches is tagged `!test` there.

## Not drawn

Remote functions (`*.remote.ts`, `query`, `form`, `command`) need SvelteKit's server and are not given. A page's layouts
(`+layout.svelte`) and `+error.svelte` are not drawn around it: a story draws its component, and a decorator adds a
layout. A param's matcher is not run (any value matches), the history is the story's own (`history.back()` is the
frame's), and `beforeNavigate` sees no `leave` navigation. The `tracing` field of a load's event is not given.

`@forgebook/sveltekit` exports the story types (`Meta`, `Story`, `Preview`, and `StorySveltekit`, `StoryPageParameters`,
`StoryKitLoad`, `StoryActionResult` for the parameters), `@forgebook/sveltekit/vite` the adapter, `@forgebook/sveltekit/page`
`storyPage()`. The rest of its exports (`./app/*`, `./frame`, `./code`, `./docs`, `./renderer`) are what the catalogue
loads itself, not for stories. Getting started, the catalogue's features and its commands:
[Forgebook's README](https://github.com/ensiria/forgebook/blob/develop/packages/forgebook/README.md).
