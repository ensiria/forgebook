---
title: How-to/Testing stories
order: 4
description: Check a story in a browser, draw the states nobody wrote, take pictures, and turn every story into tests.
---

# Testing stories

Every check that opens a browser needs `@forgebook/testing`, Playwright and the browser they run:

```sh
npm install --save-dev @forgebook/testing @playwright/test
npx forgebook browser
```

`forgebook browser` installs the one Chromium build those checks use, whatever other Playwright the project has.
`--with-deps` also installs what it needs of the system, as a CI runner does.

The commands below use a running `forgebook dev` when there is one at `--url` (Vite's `http://localhost:5173` by
default), and start a server of their own otherwise.

## Check one story

```sh
npx forgebook check stories:components-badge--default
```

It draws the story and reports accessibility (axe, WCAG 2.2 A and AA), elements that spill out of their parent, overlays
left open and errors in the page. The id may be a component's, to check all its stories.

- `--view "theme=dark&width=360"` checks it in one view; `--all-variants` in every variant the browser tests check.
- It exits 1 when a story has a problem or could not be verified (a story still `pending`, for example).
- `forgebook errors` lists what the frames open in a browser reported while you edited: a story that could not be
  shown, a play that failed. `--follow` keeps listing.

## The states nobody wrote

```sh
npx forgebook check stories:components-badge--default --stress
```

It draws the story again with long text, unbreakable words, huge numbers, empty values, right to left, 200 % zoom, a
narrow width, dark and more contrast, and lists only what each case breaks that the plain story does not. A case with
nothing to set (no text prop, no dark theme) is listed as skipped, never as passed. It exits 1 when a case adds a
problem. `--stress` takes no `--view`, `--all-variants` or `--semantic`.

## Pictures and visual changes

```sh
npx forgebook shot stories:components-badge--default            # one PNG per view, in forgebook-shots/
npx forgebook shot stories:components-badge--default --update   # store them as baselines, in forgebook-baselines/
npx forgebook diff stories:components-badge--default            # compare with the baselines
```

`diff` gives the region and the percentage that changed, with a marked picture, and exits 1 when anything differs.
`--view` takes the address's form (`theme=dark&width=360`), words (`"dark it 360"`) or a device model (`iphone-16`).

For pull requests, `forgebook proof` compares the change with its base in one run, with no stored baselines: see
[checks in CI and pull requests](./ci.md#proof-in-the-pull-request).

## Every story as a test

`@forgebook/testing` turns a package's stories into test suites:

- **in the browser** (Playwright): one test per story and variant, failing on a page error, an axe violation, a spill or
  an overlay left open;
- **visual**: the same frames compared with reference screenshots, in the Playwright container;
- **on the server** (Vitest): each story rendered to a string, so no component reads `window` or `document` while it
  renders.

The setup is a few files around the package's story source; [`@forgebook/testing`'s
README](../../packages/testing/README.md) has them.

## Agents

The same checks are MCP tools: `check_story` (with `stress: true` for the states above), `story_shot`, `visual_diff`
and `recent_errors`. `forgebook verify` runs the stories a change reaches, in every variant; see
[getting started](../getting-started.md#check-a-change-with-verify).
