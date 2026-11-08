# compat

A story tool dies when the stack under it moves and nobody notices in time, and a tool that says "works with" more
than it tests loses its users' trust the first time they find out. This command keeps `docs/compatibility.md` a record
of what was tested, never a promise: every version on it was installed and run by CI, and the page is drawn from the
results alone.

## What a run tests

`tools/compat/matrix.ts` lists each published package that draws stories, the fixture catalogue that exercises it, and
the tools it is tested against (Vite for every one, plus its framework or meta-framework). For each tool, `plan` reads
the range the package claims (its peer dependency unless the matrix names another source) and asks the npm registry
for:

- the newest release of each line the range allows: `^18.2.0 || ^19.0.0` gives the newest 18 and the newest 19;
- the tool's prerelease, when a dist-tag points ahead of `latest` (`next`, `rc`, `beta`…; `experimental` never), or
  the dist-tag the matrix names for a tool whose prereleases carry a lower number (React's `canary`).

A tool made of several packages (React and React DOM, Angular's seven) installs the same version of each, or, for a
package that ships patches of its own, its newest release of that minor. A line whose own peer range excludes what the fixtures pin
gets that package at a line it accepts, named in the matrix and shown beside the version on the page (Angular 20 with
TypeScript 5.9, since the fixtures pin TypeScript 6). A line the package's fixture is not written for, and the tool
refuses as written, runs on a fixture of its own, named by line in the matrix: SvelteKit 2 runs on `fixtures/sveltekit2`,
since `fixtures/sveltekit` is a SvelteKit 3 app. The page then names the commands that line ran. Since the overrides
reach the whole workspace, the other lines' cells hold that fixture at the version it pins, through an override scoped
to it (`@fixture/sveltekit2>@sveltejs/kit`), so its own install does not fail on a line it was not written for.

A range with anything but carets joined by `||` stops the plan instead of being guessed. A line nobody has released
stops it too.

Each cell (`run`) pins one version of one tool through pnpm's overrides in the root `package.json`, installs, checks
that the install put those exact versions in place (a cell that cannot prove it is "not run", never "passes"), then
runs the package's tests, which include the conformance suite of `@forgebook/testing`, and the fixture's tests and
static build, each where it exists; the page lists the commands each package's cells ran. Only one tool moves per cell;
everything else stays at the lockfile's versions. A version reaches the overrides only if it reads as an exact version.

## What it writes

- `docs/compatibility.json`: the results of the last run whose results differed from the one before, cell by cell,
  with the installed versions and every command's exit code.
- `docs/compatibility.md`: drawn from that file by `table`. A tool the matrix names but no run reached reads "not
  tested yet"; a planned cell that left no result (it timed out or crashed) reads "not run". A unit test fails when the
  page is not what the report draws, so a claim cannot be typed into it.

## The workflow

`.github/workflows/compat.yml` runs on Mondays and by hand (about forty cells, each a full install), and on a pull
request that changes this folder or the workflow, where the table is kept as an artefact only. After a scheduled or
manual run on develop, a job of its own, which runs nothing a cell touched, runs `publish`: it compares the results with
the report on develop and, when a cell changed, commits the two files on the `compat/table` branch through GitHub's API
(so the commit is signed) and opens a pull request, or adds to the open one and replaces its description. With no pull
request open the branch starts again from develop. It uses the release app's token, with pull-request permission,
because a pull request opened with the workflow's own token starts no checks. Nothing is force-pushed and nothing
reaches develop without a maintainer's merge.

## Files

- `compat.mts`: the commands: `plan`, `run`, `table`, `publish`.
- `matrix.ts`: the packages, their fixtures and their tools.
- `plan.ts`: the cells from the ranges and the registry, pure.
- `versions.ts`: version order and caret ranges, the only range form the matrix reads.
- `cell.ts`: one cell, run for real in a disposable checkout.
- `table.ts`: the page and the list of changed cells, pure.
- `../github-pull-request/pullRequest.ts`: the commit and the pull request through GitHub's API, shared with the
  `dependencies` command.
- `documents.ts`: every JSON the command reads, checked field by field.
- `*.test.ts`: each part on small inputs; the real matrix against the real manifests; the real page against its report.
