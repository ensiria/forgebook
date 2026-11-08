# Contributing

Thanks for helping. Bug reports, proposals and pull requests are welcome; this page says how to make each one land.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). A security problem is never a public issue:
see [SECURITY.md](SECURITY.md).

## Questions, bugs and proposals

- **A question** (how do I…, can a story…): [Discussions](https://github.com/ensiria/forgebook/discussions).
- **A bug**: an issue with the bug form. The package and its version, the Node version, the package manager, the
  browser and a story that shows it are what make it fixable.
- **A new feature**: an issue with the proposal form, before any code. Forgebook stays light on purpose (no new
  dependency of the core; a heavy tool is an optional peer of the project), so agreeing on the shape first saves a
  pull request that cannot be merged.

## Pull requests

Small fixes (a typo, a wrong message, an obvious bug with its test) can go straight to a pull request. Anything
larger starts from an issue where the shape was agreed.

- Branch from `develop` and open the pull request against `develop`; `main` is what is released. Neither takes a
  direct push or a force push: every change is a pull request, merged once the checks pass and a maintainer approved
  it.
- One change per pull request, with its tests.
- `pnpm checks` passes locally, and the shell's browser tests when the change touches the catalogue's interface.

## Setup

Node 22.18 or later (`.nvmrc` picks 24, the CI runs both) and pnpm (the version in `package.json`, through Corepack).

```sh
corepack enable
pnpm install
pnpm checks                                                # types, lint, unit tests, manifests, build: what the CI runs
pnpm --filter @fixture/app dev                             # the fixture catalogue, live
pnpm --filter @fixture/app exec playwright install chromium
pnpm --filter @fixture/app test:shell                      # the shell's browser tests on the fixture catalogue
```

The browser tests start a dev server for each fixture catalogue, about a gigabyte each. On a machine whose memory does
not hold them all, run them a group of catalogues at a time, as the Windows CI does:
`FORGEBOOK_SHELL_GROUP=1/3 pnpm --filter @fixture/app test:shell`, then `2/3` and `3/3`.

A browser test that edits a fixture file while the catalogue serves it writes through the `fileEdits` fixture
(`fixtures/app/shell/fileEdits.ts`), which waits until the dev server has taken each write and puts the file's bytes
back however the test ends, and its spec is listed in `EDITING_SPECS` (`shell/playwright.config.ts`), so it runs on one
worker and no two of its tests or repetitions edit a file at once. Other specs run beside it, so they do not open
the stories it edits.

The repository is a pnpm workspace: `packages/` holds the seventeen published packages, `fixtures/` the fixture kit,
the Storybook-style stories, the catalogue the tests run on, a catalogue for each other framework (Vue, Svelte, Solid,
Preact, Web Components, plain HTML, Angular, React Native), and small SvelteKit, Next.js and Nuxt apps with their catalogues, `tools/`
the repository's own commands (`package-build`, `check-commits`).

`docs/compatibility.md` says which versions of Vite, React and each framework every package is tested with. Nobody
writes it: the weekly `compat` workflow tests each line a package's range claims, and each tool's prerelease, then opens
a pull request when a result changed (`tools/compat/README.md`). A package that draws stories is listed in
`tools/compat/matrix.ts`; a range widened to a new major is tested from the next run, and is not supported until its
cell passes.

`docs/dependencies.md` says what each published package brings into a project and what `npm audit` finds in it. Nobody
writes it either: the weekly `dependencies` workflow installs each package's `latest` alone, audits it, and opens a pull
request when a result changed (`tools/dependencies/README.md`).

## The rules of the code

- **The core stays light.** No new dependency of `forgebook` without an issue first; a heavy tool (Playwright, Testing
  Library, Sass) is an optional peer the project installs.
- **TypeScript, strict.** No `any` and no casts: `unknown` with narrowing. `type` for data, unions of literals instead
  of enums, arrow functions, named exports, no barrels or re-exports.
- **TSDoc on everything exported**: what it is, its defaults and units. Each module starts with a TSDoc block saying
  what it does.
- **Tests with the change**: Vitest beside the code for logic, the shell's Playwright tests for the catalogue's
  interface.
- **Formatting and lint**: Biome and ESLint (`pnpm lint`, `pnpm format`).
- **Published manifests**: a package's `exports` and `bin` name its TypeScript sources; `pnpm manifest` writes the
  `publishConfig` npm installs from them, and the CI checks it is up to date.
- **Self-contained comments.** A comment says its reason in full: it never points at a decision index, a numbered
  note or another repository a reader cannot open (`pnpm refs:check`, part of `pnpm checks`, fails on them).
- **Samples that work.** Every fence in a Markdown file closes, a YAML or JSON sample parses and a link to a heading
  finds it (`pnpm blocks:check`, part of `pnpm checks`).
- **A public API changes on purpose.** A renamed or removed export, option or behaviour is a breaking change: say so
  in the issue and in the commit (below).

## Commits

[Conventional Commits](https://www.conventionalcommits.org), since the version and the changelog come from them:

```
<type>(<optional scope>): <summary in the imperative>
```

| type | when | release |
|---|---|---|
| `feat` | a new feature, option or behaviour | minor (patch while 0.x) |
| `fix` | a bug fixed | patch |
| `feat!` / `fix!`, or a `BREAKING CHANGE:` footer | a change that breaks existing code | major (minor while 0.x) |
| `perf`, `refactor`, `docs`, `test`, `style`, `build`, `ci`, `chore`, `revert` | everything else | none |

The message, body included, explains the change on its own: no decision ids, numbered notes or other repositories a
reader of this history cannot open. `node tools/check-commits/check-commits.mts --from origin/develop` checks a
branch's commits, their type and these references; the CI checks them too.

Each package gets its own version, from the commits that touch its folder; a package whose dependency was released
gets a patch.

## Version policy

### What is public

A change to any of these is breaking:

- **The configuration:** the keys of `forgebook.config.*` and of a preset, the values they take and their defaults.
- **The story format:** `@forgebook/story-format`, each adapter's story types, and what a story's fields mean.
- **The commands:** their names, options and exit codes, and the documents `--json` prints. A field added is not
  breaking. Some documents carry `schema`, raised when a field is removed or changes meaning; before 1.0 every one
  will.
- **The MCP tools:** their names, inputs and answers.
- **Each package's exports** and their types, the adapter contract (`FrameworkAdapter`) and the plugin contract.
- **What a link says:** the catalogue's addresses and their parameters, and the names `strings` replaces.
- **What the gates fail on:** `verify`, `check-code`, `check` and the other commands with an exit code for CI. Failing
  where they passed is breaking, even when the old answer was wrong, since a pipeline turns red. The exception is a gate
  that passed what it exists to catch (a security hole, a check that never ran): fixing it ships in a patch or a minor
  as a fix, says so in its commit, and gets its note all the same.

Not public: anything a package does not export, the shell's markup and class names (the theme's variables and roles are
public), the look, the layout of a build's files, and the wording of messages (agents read fields, not sentences).

### Breaking in 0.x

While the packages are 0.x, a breaking change bumps the minor version (0.3 to 0.4) and a patch never breaks. A breaking
change is a `feat!` or `fix!` commit, or one with a `BREAKING CHANGE:` footer, that says what breaks and what to do: the
changelog is written from it. A check that starts refusing what it accepted is breaking too.

### Deprecation

An option with a replacement is deprecated before it is removed. While 0.x, it keeps working for at least one minor
version. From 1.0, it is removed only in a major version, and only once at least three months have passed since the
release that deprecated it. Its TSDoc says `@deprecated` with the replacement. Before 1.0, Forgebook will also warn once
per run, in the dev server and in the commands, naming the replacement and the version that removes it: that warning is
not built yet, since nothing is deprecated today. An option removed with no replacement goes straight to the next minor
while 0.x, with its note.

### Codemods

A breaking change ships in the same pull request with:

- **its codemod, when the rewrite is mechanical** (a key renamed or gone, a string removed, a default flipped that a
  project may want to keep): a module in `packages/forgebook/bin/forgebook/migrate/`, pure and idempotent, tested on files
  before and after, listed in `codemods.ts` with the version that breaks. `forgebook migrate` runs it. A codemod that keeps
  an old behaviour is of kind `keep`, and runs only for a project coming from before the change;
- **its note, when it is not** (a gate stricter, a JSON shape): an entry in `MIGRATION_NOTES` in the same file, keyed
  on the package and version that break (each package has its own versions), which `forgebook migrate` prints;
- **its row** in the Upgrading table of `packages/forgebook/README.md`.

### The path to 1.0

1.0 says the public surface above holds until 2.0. It ships when all of this is true:

- **A compatibility table generated by CI**, per adapter, of the host versions tested, the next major or prerelease
  among them where published, and green.
- **Every breaking change since 0.3** made by `forgebook migrate` or written in its notes, and two minor releases in a row
  with no breaking change the policy did not plan.
- **The shapes settled:** the configuration's keys reviewed once more, every `--json` document and MCP answer given a
  `schema`, the story format's types and the adapter contract unchanged for those two releases.
- **The deprecation warnings** built as written above, with a test.
- **The documentation** published: getting started for people and for agents, the main how-tos, and troubleshooting from
  the errors the code prints.
- **More than one person** able to review and release, so that the project does not stop when one does.

## Releases

Merging `develop` into `main` (a pull request, like any other change) releases the packages (`.github/workflows/release.yml`, with
[Nx release](https://nx.dev/features/manage-releases)): the checks run, each package's version comes from its commits
since its last release (while 0.x, a breaking change bumps the minor and a feature or a fix the patch), its
`CHANGELOG.md` and GitHub release are written, the release commit and a `<package>@<version>` tag per package go to
`main`, each released package is packed with pnpm and staged on npm with provenance through trusted publishing (no
token), and the release commit goes back to `develop`. Those two pushes are the only direct ones the branches take: they
come from the organisation's release app (a GitHub App with write access to the contents, the rules' one exemption),
whose token the workflow makes for each run from the `RELEASE_APP_KEY` secret of the `npm` environment.

A staged version is not public yet: npm trusts the workflow to stage only, so a maintainer approves each version with
2FA, in the order they were staged (`@forgebook/story-format`, `forgebook`, `@forgebook/react`,
`@forgebook/testing`, `@forgebook/vue`, `@forgebook/nextjs`, `@forgebook/svelte`, `@forgebook/solid`,
`@forgebook/preact`, `@forgebook/web-components`, `@forgebook/html`, `@forgebook/nuxt`, `@forgebook/angular`,
`@forgebook/sveltekit`, `@forgebook/react-native-web`), so each one's dependencies are public first:

```sh
npm stage list forgebook          # the versions waiting, with their ids (and the same for each @forgebook/ package)
npm stage approve <stage-id>      # 2FA, then the version is public
```

The packages are packed by pnpm only: it applies `publishConfig` and turns `workspace:` ranges into versions, where
npm would publish the TypeScript sources; each package's `prepack` refuses any other packer.

The first release is published by hand, since npm can trust a workflow only for a package that already exists: from
`main`, signed in to npm (`npm login`, with 2FA) and to GitHub (`GITHUB_TOKEN=$(gh auth token)`), run
`pnpm nx release 0.1.0 --first-release --skip-publish`, then `pnpm -r --filter "./packages/*" publish` in a terminal (in dependency order; each
package asks for 2FA). Then, on npmjs.com, each package's settings add the trusted publisher (GitHub Actions,
`ensiria/forgebook`, workflow `release.yml`, environment `npm`, `npm publish` not allowed, so it can only stage) and
require 2FA with tokens disallowed.

A package added later goes through the first release that carries it unstaged, with a warning, since its dependencies
must be public first. Once the staged versions are approved, publish it by hand from `main`
(`pnpm --filter ./packages/<folder> publish`), then add its trusted publisher and 2FA rule as above: the next releases
stage it.
