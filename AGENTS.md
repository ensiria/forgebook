# Instructions for agents working on Forgebook

Forgebook is a catalogue for components written as CSF stories: a Vite plugin, a shell page, one frame per story, the
props read from the components' types, tests generated from the stories, and commands for tools and agents. People
contributing read `CONTRIBUTING.md`; this file is the same rules, written for an agent about to change the code.

## The repository

- `packages/forgebook`: the core (`forgebook` on npm): `src/shell` (the catalogue's page), `src/frame` (a story's
  frame), `src/vite` (the plugin, the props extractor, the answers to tools and agents), `bin/` (`forgebook`,
  `forgebook-docs`, `forgebook-texts`).
- `packages/react` (`@forgebook/react`), `packages/vue` (`@forgebook/vue`), `packages/nextjs` (`@forgebook/nextjs`, on
  React's), `packages/svelte` (`@forgebook/svelte`), `packages/solid` (`@forgebook/solid`), `packages/preact`
  (`@forgebook/preact`), `packages/web-components` (`@forgebook/web-components`), `packages/story-format`
  (`@forgebook/story-format`, no dependencies), `packages/testing` (`@forgebook/testing`).
- `fixtures/`: the kit, the stories written the Storybook way, the catalogue the shell's browser tests run on, and the
  Vue, Svelte, Solid, Preact and Web Components catalogues (`fixtures/vue`, `fixtures/svelte`, `fixtures/solid`,
  `fixtures/preact`, `fixtures/web-components`) and small Next.js app (`fixtures/nextjs`) whose catalogues they open
  beside it.
- `tools/`: the repository's own commands (`package-build`, `check-commits`, `bench`).

## Before you say a change is done

```sh
pnpm checks                                                # types, lint, unit tests, published manifests, build
pnpm --filter @fixture/app exec playwright install chromium   # once
pnpm --filter @fixture/app test:shell                      # when the shell, the frame or the plugin changed
```

Both must pass. A rule is never silenced to get a green run: an ignore comment only where the rule is wrong for that
case, with the reason (`// biome-ignore lint/…: the protocol names this field`).

## How Forgebook is built

- **Independent of what it shows.** The core imports nothing of the libraries it shows: a tool that checks a library
  must not break with it. Its look is its own (`src/styles/_tokens.scss`), and a catalogue can theme it (`src/shellTheme.ts`); the frame is
  left to the source's style sheets; an app passes its sources.
- **A library carries nothing for the catalogue.** Forced states (`:hover`, `:focus`…) are a rewrite in the
  catalogue's build, never classes or attributes in a library's CSS; a story is shown, never patched.
- **One document per story.** Anything that changes a frame's document (switches, style sheets, text size) goes
  through the address, so the shell, the frames, the tests and the tools agree.
- **Two runtimes.** `src/shell` and `src/frame` run in the page. `src/vite` and `bin/` run on Node directly, their
  types stripped, so their relative imports carry `.ts` (each folder has its own `tsconfig.json`).
  `src/componentDocs.ts` is the shape both sides share. `packages/testing` runs inside Playwright or Vitest.
- **Windows too.** CI runs the checks and the shell's suite on Windows. A path the Node side compares with a Vite id,
  writes into generated code or uses as a key goes through `src/vite/vitePaths.ts` (forward slashes on every system,
  as Vite's ids), and its logic is tested with `path.win32`; a package's command (`pnpm`, `npm`) is a `.cmd` there,
  which only a shell starts.
- **The props extractor reads types, never runs code**: TypeScript 6's compiler API (`typescript-6`, an alias: the
  repository type-checks with TypeScript 7, which has no compiler API), the props declared in the package only.
- **Tools and agents get what the shell shows**: the dev server's answers (`src/vite/agentRoutes.ts`) load the same
  sources and previews as the pages; `forgebook stories`, `forgebook story` and `forgebook mcp` are its clients.
- The shell's texts are in `src/shell/strings.ts`, one place. Messages between the shell and a frame are typed in
  `src/messages.ts` and checked on arrival, from the other side's origin only: the frames run on an origin of their
  own (`src/frameOrigins.ts`, the dev server's second port in `src/vite/framesServer.ts`), so a story cannot reach the
  catalogue; nothing in the shell reads a frame's document directly.
- **The core stays light.** No new dependency of `forgebook` without an issue first; a heavy tool (Playwright, Testing
  Library, Sass) is an optional peer the project installs.

## The code

- TypeScript, strict. No `any` and no casts: `unknown` with narrowing. `type` for data, unions of literals instead of
  enums, arrow functions, named exports, no barrels or re-exports.
- TSDoc on every module (a block first: what it does, `@remarks` for the why, `@module`) and on everything exported:
  what it is, its defaults and units, in TSDoc syntax (code in backticks).
- Comments explain why the code is as it is, never its history: no dates, no names, no account of what was tried.
- No reference to notes outside this repository, in a file or a commit message: no decision ids (a `D` and a
  number), no numbered notes (`note` and a number), no private repository. A reader of this public repository cannot
  open them, so the comment or the message says the reason itself. `pnpm refs:check` (part of `pnpm checks`) and `check-commits` fail
  on them.
- Look for what exists before writing: a helper two places need exists once (`storyTree.ts`, `viewState.ts`,
  `storyModule.ts` hold most of what the pages and the tools share).
- Commands are built on `@ensiria/cli-kit` (definitions, help, output, exit codes), never `console.log` or a
  hand-written usage text.
- Tests come with the change: Vitest beside the package (`packages/*/test`) for logic, the shell's Playwright suite
  for what a person sees, a command run as a process for a command.

## Packages and releases

- A package's `exports` and `bin` name its TypeScript sources; `pnpm manifest` writes the `publishConfig` npm
  installs from them, and `pnpm checks` fails when it is out of date. The packages are packed by pnpm only (their
  `prepack` refuses another packer).
- Work goes to `develop` in conventional commits (`feat:`, `fix:`, `feat!:`…; the versions and changelogs come from
  them), one change per commit with its tests. Never publish to npm or push to `main`: the maintainers release.
