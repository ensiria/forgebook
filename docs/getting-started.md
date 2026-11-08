---
title: Getting started
order: 1
description: Install Forgebook, let init write the configuration, write a first story, run it and build it.
---

# Getting started

Forgebook is a story catalogue for components, built on Vite. You write stories in CSF 3, `forgebook dev` shows each
one in its own frame, and the props table comes from your components' TypeScript types. This page goes from an empty
project to a running catalogue and a static build, then sets up a coding agent.

You need Node 22.18 or later and a project with one of the supported frameworks (see
[frameworks](./how-to/frameworks.md)). The examples use React and npm; `init` prints the command for your own
package manager.

## 1. Let `init` write the configuration

In the folder of the package that holds the components:

```sh
npx forgebook init
```

It asks nothing, so a script or an agent can run it. It reads the framework and the package manager from the
project's files and writes:

- `forgebook.config.ts`: the adapter, the title, and story globs over the folders that exist;
- `forgebook.preview.ts` (`.tsx` where stories are) when the app loads global style sheets: the same imports as the
  app's entry, since stories look wrong without them.

Then it prints what is left to do, each item named, starting with the install command:

```text
✓ React project, npm (package-lock.json)
✓ forgebook.config.ts written: 1 story glob
✓ forgebook.preview.tsx written
› npm install --save-dev forgebook @forgebook/react: Install what the configuration imports.
› npx forgebook new <component file>: Write a component's first stories (React).
› npx forgebook dev: Open the catalogue.
› npx forgebook stories --json: List the stories, and what did not read.
› npx forgebook agents: Tell the project's coding agents about the catalogue.
```

Run that install, or give `--install` to have `init` run it. React is in the list even on Vue or Svelte: the
catalogue's own interface is React, while the frame of a story in another framework loads none.

The options, all optional:

| Option | What it does |
|---|---|
| `--install` | Runs the package manager's install of what the configuration imports |
| `--force` | Replaces a `forgebook.config.ts` or a preview that is already there |
| `--framework <name>` | Chooses the framework when `package.json` does not settle it (`html` for none) |
| `--from storybook` | Reads the project's `.storybook` folder instead; see [coming from Storybook](./how-to/from-storybook.md) |
| `--agents` | Also sets up coding agents; see [for agents](#for-agents) below |
| `--json` | Prints the result, or the refusal, as a JSON document |

`init` runs none of the project's code unless `--from storybook` or `--install` asks for it. When it cannot go on
it writes nothing and says why: [troubleshooting](./troubleshooting.md#forgebook-init) lists each refusal.

`init` cannot work out what the app's entry does at run time: the providers it wraps the app in, a portal element
beside its root, a font loaded from the page's head. It names each one it finds; the [preview](./how-to/writing-stories.md#the-preview)
is where they go.

## 2. Write a first story

`forgebook new` writes a component's first stories from its props, and from where the application already draws it:

```sh
npx forgebook new src/components/Badge.tsx
```

It writes `src/components/Badge.stories.tsx` beside the component: a main story with the values the app uses most,
one story per choice of a union prop, and a worst case with long text. `--print` shows the file without writing it,
and `--export <name>` picks the component when the file exports several.

A story file by hand looks like this:

```tsx
// src/components/Badge.stories.tsx
import type { Meta, Story } from "@forgebook/react";

import { Badge } from "./Badge";

export default { title: "Components/Badge", component: Badge } satisfies Meta<typeof Badge>;

/** The label as most pages use it. */
export const Default: Story<typeof Badge> = { args: { label: "New" }, parameters: { main: true } };

/** A success. */
export const Success: Story<typeof Badge> = { args: { label: "Paid", tone: "success" } };
```

Check what the catalogue lists, and whether any file failed to read:

```sh
npx forgebook stories
```

## 3. Run it

```sh
npx forgebook dev
```

It prints two addresses: the catalogue, and the frames, on the next port, where your stories run on an origin of
their own. Edits to a story, a component or the preview redraw in place, without a reload. `--port <number>` picks the
port; `--poll` helps where file change events come late or never (a container's mounted volume, WSL, a network drive).

## 4. Build it

```sh
npx forgebook build
```

The catalogue is written to `dist/` as static files that any web server can host. `--out <folder>` writes elsewhere, and
`--base /pr-12/` builds for a host that serves it under a sub-path. Keep the output folder out of git (add it to
`.gitignore`): [`verify`](#check-a-change-with-verify) counts a built script it sees in the repository as a changed UI file.
More in [publishing a catalogue](./how-to/publishing.md).

## For agents

Forgebook gives a coding agent the same catalogue a person sees, so it can check a UI change before it says the work
is done. One command sets a project up:

```sh
npx forgebook init --agents
```

On top of what `init` writes, and without replacing anything already there, it writes:

- `.mcp.json` with Forgebook's MCP server, beside the servers already listed;
- Forgebook's section in `AGENTS.md`, and the same text as an Agent Skill in `.agents/skills/forgebook` and
  `.claude/skills/forgebook`;
- a GitHub workflow, `.github/workflows/forgebook-verify.yml`, that runs `forgebook verify` on pull requests (only
  when the repository is on GitHub; otherwise it prints the two commands to put in your CI);
- a hook that runs `verify` when the agent is about to finish, so it cannot stop on red. `--hooks` chooses them, by
  commas: `claude`, `codex`, `cursor`, `gemini`, `pre-commit`, `none`. By default `init` writes those of the
  assistants the repository shows signs of, otherwise the commit hook.

Two more options do the rest unattended:

```sh
npx forgebook init --agents --browser --draw --json
```

- `--browser` installs `@forgebook/testing` and the browser the checks run in (about 200 MB), and implies `--install`;
- `--draw` writes a component's first stories and draws them in the browser, trying components until one draws, and
  says why each one that did not failed. It exits 1 when none draws.

### What the agent uses

- **The instructions.** `forgebook agents` writes or renews Forgebook's section of `AGENTS.md` (under 3 KB);
  `--skill` writes the Agent Skill too. `forgebook guide` lists the longer topics an agent reads on demand
  (`forgebook guide stories`, `forgebook guide react`, `forgebook guide all`).
- **The MCP server.** `forgebook mcp` serves 23 tools over stdin and stdout: `list_stories`, `get_story`,
  `check_story`, `story_shot`, `verify` and the rest. `.mcp.json` written by `init --agents` starts it:

  ```json
  { "mcpServers": { "forgebook": { "command": "npx", "args": ["--no", "forgebook", "mcp"] } } }
  ```

  It uses a running `forgebook dev` when there is one at `--url` (Vite's `http://localhost:5173` by default), and
  starts a server of its own otherwise.
- **The commands**, each with `--json`: `forgebook stories`, `forgebook story <id>`, `forgebook check <id>`,
  `forgebook shot <id>`, `forgebook errors`.

### Check a change with `verify`

```sh
npx forgebook verify
```

`verify` says whether a change is done: every UI file the branch changed since it left the default branch must reach a
story, and those stories must run in every variant without a problem the change brought (`--all-problems` counts
those the stories already had too). It needs `@forgebook/testing` and its browser:

```sh
npm install --save-dev @forgebook/testing @playwright/test
npx forgebook browser
```

Its last line is the verdict. It exits 1 on `not-verified` or `failed`, and 0 otherwise, including `partly-verified`,
as here, where colours and sizes went unchecked:

```text
1 changed UI file, 1 with stories: verified in every variant (30 checks); colours and sizes not checked: no tokens file
```

A file no story reaches is `not verified`, with the fix (usually `forgebook new <file>`). `--quick` checks the
default view only, as the commit hook does; `--since <ref>` compares with another commit.

## Next

- [Writing stories](./how-to/writing-stories.md): args, controls, the preview, plays, tags.
- [Testing stories](./how-to/testing.md) and [checks in CI and pull requests](./how-to/ci.md).
- [Troubleshooting](./troubleshooting.md), when a command stops with an error.
- The [`forgebook` README](../packages/forgebook/README.md) is the full reference.
