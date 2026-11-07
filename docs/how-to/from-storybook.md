---
title: How-to/Coming from Storybook
order: 8
description: Run your existing Storybook stories in Forgebook, and what does not carry over.
---

# Coming from Storybook

Forgebook reads Storybook story files as they are, so you can try it beside Storybook without changing a story.

```sh
npx forgebook init --from storybook
```

Run it in the folder that holds `.storybook` (or on-device Storybook's `.rnstorybook`). It loads `main`, which runs
its code, and writes `forgebook.config.ts`:

- the story globs of `main`, with the MDX pages left out;
- the preview, used as Forgebook's preview;
- a switch for each toolbar global of the preview whose `globalTypes` are written as plain values.

It never replaces a configuration without `--force`, and lists what it left out. Without `--from storybook`, `init`
stops on a project whose `.storybook` folder has a `main` file and asks you to choose; `--framework <name>` starts
from the dependencies instead and loads nothing of Storybook's. `init --agents` sets the agents up beside Storybook,
on the same stories, without loading it.

## What carries over

- CSF 3 and CSF 2 (`Template.bind({})`), titles of any depth or from the file's path, `args` and `argTypes` with their
  controls, actions from `fn()` or an `argTypes` action, `loaders`, `tags`, a story's `globals`.
- `play` with Testing Library, when `@testing-library/dom` and `@testing-library/user-event` are installed.
- Decorators, and in React files Storybook's preview hooks from `storybook/preview-api` (`useArgs`, `useGlobals`,
  `useParameter`, `useStoryContext`).
- Story ids, so links carry over, and `args=` links written in Storybook's form.
- The frameworks: React, Vue, Svelte, SvelteKit, Preact, Solid, Web Components and HTML on Vite, Nuxt, Angular
  (Analog too), Next.js (on Vite or webpack) and React Native.

## What does not

- MDX files and doc blocks. Write docs pages in Markdown instead: see [docs pages](./docs-pages.md).
- Addons, and anything that reaches them: `useChannel` throws.
- An `on*` prop is not turned into an action by its name; actions are explicit.
- `main`'s `viteFinal`: the catalogue reads the app's own `vite.config` instead, see
  [the app's build](./frameworks.md#the-apps-own-build).

The full list is under [coming from Storybook](../../packages/forgebook/README.md#coming-from-storybook) in the reference.
