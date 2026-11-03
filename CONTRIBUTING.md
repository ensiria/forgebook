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

The repository is a pnpm workspace: `packages/` holds the fifteen published packages, `fixtures/` the fixture kit,
the Storybook-style stories, the catalogue the tests run on, a catalogue for each other framework (Vue, Svelte, Solid,
Preact, Web Components, plain HTML, Angular, React Native), and small SvelteKit, Next.js and Nuxt apps with their catalogues, `tools/`
the repository's own commands (`package-build`, `check-commits`).

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
