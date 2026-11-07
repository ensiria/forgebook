# `git switch` with the dev server running

What a person sees when they switch branches while `forgebook dev` runs: does the catalogue follow the branch, or keep
the stories of the one they left?

## The claim

After `git switch` to a branch with other stories and back, with `forgebook dev` running and no restart:

- the sidebar lists the branch's stories, a story the branch removed is gone, and a story in a folder that did not
  exist before is shown;
- a story file the branch changed is drawn as that branch writes it;
- the agents' answers (`forgebook stories`, the MCP server) list the same stories as the sidebar;
- an edit made after the switches is drawn.

## How it was checked

A repository of its own, two branches: `main` with `Inputs/Button › Primary` and `Layout/Card › Plain`; `other` with
the button's story renamed to `Secondary`, the card removed, and `Forms/Field › Empty` in a new `src/forms/` folder. The
dev server ran throughout; Playwright kept the page open and switched branches with `git switch`.

`fixtures/app/shell/gitSwitch.e2e.ts` is that check, kept in the shell suite: three round trips, the sidebar and the
agents' API after each switch, the changed and the new story drawn, then an edit.

## What was found

On macOS the dev server missed checkouts. Vite's watcher reads FSEvents, which a busy machine delivers late and
coalesces, and a branch switch writes, removes and adds files within milliseconds. Measured on a shared Mac under load
(load average 37 to 50), on the commit this note came with:

| | Before | After |
|---|---|---|
| A plain Vite dev server's watcher, 12 switches waited on for 4 s each | a story file event for 1 switch | not changed: Vite's own |
| The same, 6 switches waited on for 20 s each | events for 2 switches | not changed: Vite's own |
| `forgebook stories` polled after each of 6 switches | 1 switch never seen (still stale 60 s later, an edit after it unseen too); others 1 to 14 s | 10 of 10 seen, within the poll's 1 to 3 s |
| The page's sidebar, 10 switches | 0.1 to 14.5 s | 0.2 to 1.1 s |
| `gitSwitch.e2e.ts`, 3 runs | 3 of 3 failed (a switch not shown within 20 s) | 3 of 3 passed, 9 to 11 s each |

A switch missed is not only late: the module that lists the story files is never renewed, so every later answer, the
agents' included, keeps the old branch's stories, and an edit that comes after it can be missed as well.

## The fix

The dev server watches git's own `HEAD` and `index` files, each on its own (a kernel event, kqueue on macOS, not
FSEvents). When `HEAD` names another commit, `git diff --name-status` between the two says which files changed, and each
one the checkout wrote is handed to Vite's watcher as its own event, so the lists, the modules and the pages' reload run
as they would have (`packages/forgebook/src/vite/checkoutWatch.ts`). A file git names that is untouched on disk since the
last checkout seen is left out, so a commit, which moves `HEAD` and rewrites nothing, sends nothing.

## Limits

- Only where the watcher reads FSEvents (macOS without `--poll`): elsewhere the system's events come at once.
- A checkout that keeps `HEAD` where it was (`git checkout -- <file>`, `git stash`) is left to the system's events.
- When FSEvents does deliver the same events later, the dev server hears them twice: an extra reload of the pages at
  most.
- Linux and Windows were not measured here; the shell suite runs `gitSwitch.e2e.ts` on both in CI.
