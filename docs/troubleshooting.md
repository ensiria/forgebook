---
title: Troubleshooting
order: 3
description: The errors Forgebook prints, what causes each, and the fix.
---

# Troubleshooting

Each entry starts with the message as the command prints it: `✗` marks the error, and the indented line under it is
the hint the command gives. A part in angle brackets (`<file>`) is filled in with your project's value. Add
`--verbose` to any command for its debug lines, and `--json` to the commands that take it for the same answer as a
document.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Done: the catalogue built, the check passed, the change is verified |
| 1 | The work failed, or found problems: a refused configuration, a failed check, `verify`'s `not-verified` or `failed` |
| 2 | The command line was wrong: an unknown option, a missing or invalid argument |
| 130 | Stopped with Ctrl+C |
| 143 | Stopped by SIGTERM |

`forgebook hook <assistant>` also exits 2 when it sends a coding agent back to work on red, as the assistants' hooks
expect.

## forgebook init

`init` writes nothing when it refuses. With `--json` the refusal is a document (`refused`, `message`, `hint`) on stdout,
with exit code 1.

```text
✗ No package.json here, so no framework can be read
  Run forgebook init in the folder of the package that holds the components
```

`init` reads the framework from the package that holds the components. In a workspace, `cd` into that package.

```text
✗ package.json names no framework Forgebook supports. Supported: <frameworks>
  In a workspace, run it in the package that holds the components; otherwise name one with --framework <name> (html for no framework)
```

No dependency names a framework `init` knows. Name one with `--framework react` (or `vue`, `svelte`…), or `html` for
stories that return HTML strings or DOM nodes.

```text
✗ package.json names several frameworks: <frameworks>
  Choose the stories' with --framework <name> (<frameworks>)
```

Two frameworks that each stand on their own are dependencies. Choose the one the stories are written in with
`--framework`. An adapter already in `package.json` (`@forgebook/vue`) settles it on its own.

```text
✗ This project is on Storybook (.storybook): its files say more than package.json does
  --from storybook reads them, which loads .storybook/main and so runs its code; --framework <name> starts from the dependencies instead
```

The project has a `.storybook` folder with a `main` file. `--from storybook` imports its globs, preview and toolbar
globals (and runs `main`); `--framework <name>` ignores it. See [coming from Storybook](./how-to/from-storybook.md).

```text
✗ forgebook.config.ts is already there
  Give --force to replace it
```

A catalogue's configuration or preview exists already, under any name it is read by. `--force` replaces it;
`init --agents` keeps it and adds only the agents' files.

```text
✗ forgebook.config.ts is a link: writing through it would change a file elsewhere
  Remove the link, then run forgebook init again
```

`init` never writes through a symbolic link, even with `--force`.

```text
✗ Forgebook cannot draw this project yet: <packages and versions>
  Upgrade them, then run forgebook init again. Nothing was written
```

A package Forgebook or the adapter asks the project for (the framework, React) cannot reach the version needed; the
message names each as `<name> <version> is below <lowest>`. Upgrade them. Vite is not among them: Forgebook brings its
own, and a project's older Vite stays as it is.

```text
✗ --from and --framework choose two different routes: give one
✗ --hooks goes with --agents
✗ --hooks has no <names>
  It takes <the hook names>
```

Wrong command lines, exit code 2. `--hooks` takes `claude`, `codex`, `cursor`, `gemini`, `pre-commit` or `none`, by
commas.

### init --draw

`--draw` tries components until one draws, and says why each one that did not failed, with a `kind` in `--json`
(`draw.attempts`). The common ones:

| `kind` | What to do |
|---|---|
| `provider` | The component needs what the app wraps it in: add a decorator with that provider to the [preview](./how-to/writing-stories.md#the-preview) |
| `missing-import` | An import does not resolve: install the project, or check the aliases `forgebook dev` says it read |
| `style-sheet` | A style sheet did not compile: check the preview's imports and the app's PostCSS |
| `needs-props` or `blank` | The component needs props or data the first story does not give: complete its args |
| `server-only` | A server component: try a client component, or give it what it reads through the story's parameters |
| `app-config` | The app's `vite.config` did not load: fix what it says, or set `appBuild: { viteConfig: false }` |
| `timeout` | No answer in time: the component may wait for data, or a plugin of the app starts a process (name it in `appBuild.skipPlugins`) |
| `older-forgebook` | The project installed an older `forgebook` than the one running: install the same version |

## The configuration

```text
✗ No forgebook.config.ts here
  Run forgebook in the catalogue's folder, or give --config
```

Every command but `init` reads the catalogue's configuration from the current folder. `cd` into it, give
`--config path/to/forgebook.config.ts`, or run `npx forgebook init` to write one.

```text
✗ <file>: it has no key "<key>". <a suggestion, or the keys it takes>
```

For example `it has no key "titel". Did you mean title?`.
A key nothing reads stops every command and a build, since it would give a catalogue that looks right and is not. The
keys of a preset, of `build`, `shell`, `a11y`, `backgrounds`, `widthRange` and `controls` are checked the same way.
A syntax error is named with its place (`<path>/forgebook.config.ts:3:3: …`).

```text
✗ forgebookPlugin runs on Vite 8.3.4 or later, and this vite.config runs on an older one: run the catalogue with the forgebook command, which brings its own, or upgrade Vite
```

The plugin is used from the app's own `vite.config` on an older Vite. The `forgebook` command brings its own Vite;
use it, or upgrade the app's.

## No story file matches

```text
✗ No story file matches "src/**/*.story.tsx" (`stories` in the configuration)
  Correct the pattern, or write the first story: forgebook new <component file>
```

`forgebook build`, `stories` and `check` stop when a story pattern matches no file; each pattern is read on its own,
so a mistaken one beside one that works is named too. `forgebook dev` only warns and opens a home that says where it
looks, and `verify` answers `not-verified` with the pattern in `skipped`.

A `**` does not enter folders whose names start with a dot. When story files sit there, the commands say so:

```text
<count> story files sit in a hidden folder the stories' patterns do not enter: list them with <pattern>, or write a `!` pattern for the folder to leave it out
```

## A file that does not parse

```text
<file>:<line>:<column> does not parse: <the parser's message>
```

On the dev server a story file or a component that does not parse is one problem, named on the page, in
`forgebook stories` and in `forgebook errors`, and the rest of the catalogue keeps drawing; saving the fix is enough.
`forgebook build` and the test runs fail on it. `--verbose` adds the bundler's stack to a failed build.

## forgebook build

A failed build prints each of the bundler's errors on a line, with its file, line and column when they are known, and
exits 1. The common causes are the two above: a file that does not parse, and a pattern that matches nothing. A build
also fails on every configuration error the other commands stop on.

## Checks in the browser

```text
✗ Stories run in a browser with @forgebook/testing: npm install -D @forgebook/testing @playwright/test, then forgebook browser
```

`check`, `shot`, `diff`, `verify` and `proof` draw stories in a browser. Install the testing package and Playwright,
then the browser with `npx forgebook browser` (`--with-deps` on a CI runner). `verify` shows the same reason for each
file whose stories could not run.

```text
✗ @forgebook/testing and @playwright/test are not installed here
  npm install -D @forgebook/testing @playwright/test, or forgebook init --browser
```

`forgebook browser` needs the same two packages first.

```text
✗ @forgebook/testing/<module> is not in this @forgebook/testing: update it
```

The installed `@forgebook/testing` is older than the `forgebook` that asks it: install the same release of both.

```text
✗ No story or component "<id>"
```

The id is not in the catalogue. Ids carry their source's id first: a catalogue's own stories are
`stories:components-badge--default`. `forgebook stories` lists them.

### A story that is pending

A frame waits up to 10 s for what a story loads (`Suspense` in React and Vue). Past that the story is `pending`:
`check` reports it not verified and exits 1, and `verify` answers `not-verified`. Mark a loading state with
`parameters: { suspense: { expected: true } }`, or give a slow story longer with
`parameters: { suspense: { timeout: 15_000 } }`. See [stories that load](./how-to/writing-stories.md#stories-that-load).

## forgebook verify

`verify` prints one line per changed UI file it could not verify, then its verdict, and exits 1 unless the change is
verified.

```text
<file>  not verified: <reason> Fix: <fix>
```

The reason is one of these:

```text
no story reaches it.
```

No story imports the file, directly or through other components. Write its stories, or use it from a component that
has some. A style sheet gets the fix of importing it in the preview. Keep build output out of git (`dist/`), or its
scripts count as changed UI files.

```text
its stories did not run: <why>
```

The stories exist but could not run; the reason follows, most often the missing testing package above.

After the verdict, `colours and sizes not checked: no tokens file` is not an error: with no tokens file, and no custom properties, Tailwind theme or `components.json` in the application,
hand-written colours and sizes are not compared with anything. See [design tokens](./how-to/theming.md#design-tokens).

## The dev server

```text
✗ --port <value> is not a port
✗ --frame-port <value> is not a port
✗ --frame-port asks for a port the frames do not use
  They run on the catalogue's origin (frames: "same-origin", or --frames same-origin)
```

`--port` and `--frame-port` take a port number. The frames' port is only used when the frames run on an origin of their
own, which is the default.

```text
✗ No catalogue running there to follow
  Start forgebook dev, then follow its errors (or give --url where it runs)
```

`forgebook errors --follow` lists what open frames report, so it needs a running `forgebook dev`. Give `--url` when it
does not run at Vite's default address.

## forgebook new

```text
✗ <file> exists
  Give --force to replace it, or --print to see it
✗ <file> exports no component
✗ <file> is in no package
```

`new` writes a story file beside the component, and never replaces one without `--force`. A file that exports several
components needs `--export <name>`. The component's file must sit in a folder with a `package.json` above it.

## Mocked requests

```text
The installed MSW has no getResponse: MSW 2.11 or later is needed
```

`@forgebook/plugin-msw` answers a story's requests with MSW's `getResponse`. Upgrade `msw`.

## Other commands

```text
✗ Give a token's name or --nearest, not both
✗ No topic <topic>
  forgebook guide lists them
✗ Name the ref to compare with: --base origin/main
✗ .github/workflows/forgebook-proof.yml is already there: delete it to write it again
```

`forgebook tokens` takes one of the two; `forgebook guide` with no topic lists the topics; `forgebook proof` needs
`--base` unless it is writing its workflow, which it never overwrites.
