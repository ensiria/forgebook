---
title: Documentation
order: 0
description: Where to start, the how-to guides, and troubleshooting.
---

# Forgebook documentation

- [Getting started](./getting-started.md): install, `forgebook init`, a first story, `dev` and `build`, then a coding
  agent set up with `init --agents` and `verify`.
- [Troubleshooting](./troubleshooting.md): the errors the commands print, what causes each, and the fix; the exit codes.

## How-to guides

- [Writing stories](./how-to/writing-stories.md): story files, args and controls, the preview, plays, tags.
- [Docs pages](./how-to/docs-pages.md): guides in Markdown with live stories and props tables.
- [Theming and tokens](./how-to/theming.md): the shell's colours, fonts and logo; design tokens.
- [Testing stories](./how-to/testing.md): browser checks, the stress cases, pictures, generated tests.
- [CI and pull requests](./how-to/ci.md): `verify` on every pull request, the proof comment, previews.
- [Publishing a catalogue](./how-to/publishing.md): static builds, sub-paths, headers, embedding.
- [Frameworks](./how-to/frameworks.md): the adapter for each framework, and the app's own build.
- [Coming from Storybook](./how-to/from-storybook.md): what carries over and what does not.
- [Monorepos](./how-to/monorepos.md): one catalogue for several packages.

## Reference

- The [`forgebook` README](../packages/forgebook/README.md) describes every feature and configuration key.
- `npx forgebook --help` lists the commands, and `npx forgebook <command> --help` each one's options.
- Each adapter's README, linked from [frameworks](./how-to/frameworks.md), covers its framework.
