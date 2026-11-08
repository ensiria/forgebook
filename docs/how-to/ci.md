---
title: How-to/CI and pull requests
order: 5
description: Run verify on every pull request, post a before-and-after proof, and keep a preview of the catalogue.
---

# CI and pull requests

Three jobs a repository can run, each on GitHub Actions here, though nothing in them is specific to it.

## Verify on every pull request

`forgebook init --agents` writes `.github/workflows/forgebook-verify.yml` when the repository is on GitHub. Its steps,
for npm:

```yaml
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
    with:
      fetch-depth: 0
  - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
    with:
      node-version: 24
  - run: npm ci
  - run: npx --no forgebook browser --with-deps
  - run: npx --no forgebook verify --since "origin/$BASE_BRANCH"
    env:
      BASE_BRANCH: ${{ github.base_ref }}
```

`fetch-depth: 0` matters: `verify` compares with where the branch left its base, which a shallow clone does not hold.
The job fails unless every UI file the pull request changed reached a story that ran without a problem in every
variant. On another CI, run the same two commands after the install.

## Proof in the pull request

```sh
npx forgebook proof --write-workflow
```

writes `.github/workflows/forgebook-proof.yml`. On each pull request it draws the states the change touches twice in
one run, from the base and with the change, and posts one comment with what changed and what was not checked, replaced
on each push. The pictures are the run's artefact.

- No baseline is stored, so there is nothing for anyone to approve or for an agent to update.
- A state that also differs between two pictures of the same code is `unstable`, and proves nothing.
- A changed picture does not fail the job: a person judges it. `--fail-on-verdict` holds it to `verify`'s verdict, as
  the written workflow does.
- The job that runs the branch's code holds no write token; the job that posts the comment runs none of it. Never run
  it on `pull_request_target`. A fork's pull request gets no comment, only the run's summary and artefact.

To try it locally: `npx forgebook proof --base origin/main --out proof`, then open `proof/index.html`. The reference's
[proof in the pull request](../../packages/forgebook/README.md#proof-in-the-pull-request-made-by-ci) section has the
details.

## A preview for every pull request

`forgebook build` writes static files, so any static host can give each pull request its own catalogue. `--base` builds
for a sub-path:

```yaml
- run: npx forgebook build --out preview --base "/pr-${{ github.event.number }}/"
- uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
  with:
    name: catalogue-preview
    path: preview
```

Then publish the folder with the host you use. [Publishing a catalogue](./publishing.md) covers the headers a host
needs.

## Before the first start

`forgebook prebundle` pre-bundles the catalogue's dependencies, which `dev` otherwise does on its first start: run it
in an image or a CI cache step so later starts are fast.
