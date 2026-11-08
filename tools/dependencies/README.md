# dependencies

Someone choosing a story tool asks what it will add to their project and how many advisories `npm audit` will print
afterwards. A number typed into a README is wrong a week later, so this command keeps `docs/dependencies.md` a record
of what npm installed and audited, written by CI from the results alone.

## What a run measures

For each package the repository publishes (every `packages/*` that is not private), `measure` makes an empty project in
a temporary folder and runs `npm install <package>@latest --package-lock-only --ignore-scripts`: npm resolves the tree a
user would get today and writes the lockfile, but downloads no package and runs no install script. It then runs
`npm audit --json` on that lockfile. From the two it keeps:

- the version `latest` named, and how many dependencies the package's own manifest lists;
- how many packages npm adds with it, the package itself and its peers left out, and how many of those are optional
  (platform binaries, of which a machine installs one);
- how many packages come only through its peer dependencies, which npm adds when the project has none;
- each advisory, once, with whether the package it is about comes only through a peer.

The published versions are measured, not the workspace: the repository's lockfile holds the versions its own tests
pin, while a user's install resolves the newest versions the ranges allow. A package npm does not have yet reads "not
on npm yet". Any other install failure stops the run.

## What it writes

- `docs/dependencies.json`: the results of the last run whose results differed from the one before.
- `docs/dependencies.md`: drawn from that file by `table`. A unit test fails when the page is not what the report draws,
  so a number cannot be typed into it. Text from npm's answer (an advisory's title) is escaped, and only GitHub's
  advisory pages are linked.

## The workflow

`.github/workflows/dependencies.yml` runs on Mondays and by hand, and on a pull request that changes this folder or the
workflow, where the page is kept as an artefact only. After a scheduled or manual run on develop, a job of its own runs
`publish`: it compares the report with the one on develop and, when a package's result changed (a new version, a count,
an advisory), commits the two files on the `dependencies/report` branch through GitHub's API and opens a pull request,
or adds to the open one. A run that only confirms the page opens nothing. The commit and the pull request go through
`../github-pull-request/pullRequest.ts`, shared with `compat`, with the release app's token for the same reason: a pull
request opened with the workflow's own token starts no checks.

A pull request's checks do not run `npm audit`: an advisory published overnight would turn every open pull request red
for a change none of them made.

## Files

- `dependencies.mts`: the commands: `measure`, `table`, `publish`.
- `measure.ts`: a package from npm's lockfile and audit, and the report read back, pure.
- `table.ts`: the page and the list of changed packages, pure.
- `dependencies.types.ts`: the report's shapes.
- `dependencies.test.ts`: each part on small inputs, and the real page against its report.
