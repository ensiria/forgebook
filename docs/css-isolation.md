# CSS isolation between stories

A story file that imports global CSS (`body`, every `button`, a custom property on `:root`) styles its own frame and
nothing else. This note records how that was tested and what the static build's default of one origin means.

## What was tested

`fixtures/app/shell/cssIsolation.e2e.ts` builds a small React catalogue of its own: `Loud.stories.tsx` imports a sheet
that paints `body` and every `button` red and sets `--leak` on the root; `Quiet.stories.tsx` imports nothing; a docs page
shows one story of each. The same four checks run in three servings:

| Check | Dev server (frames on a second port) | Static build, one origin (as it ships) | Static build, `frames.origins` named |
|---|---|---|---|
| The loud story's own frame is red | yes | yes | yes |
| After the loud story, the next component's frames and the catalogue's page are untouched | untouched | untouched | untouched |
| On one docs page, the quiet frame and the page are untouched by the loud frame beside them | untouched | untouched | untouched |
| A story's script can read `window.parent.document` | no | **yes** | no |

Every story draws in a document of its own, and the shell opens another story by loading another page, so a sheet a
story file imports leaves with its frame. Stories of one file share their module, so they share what it imports: that
is the file's choice, not a leak.

## Numbers

- 12 tests, 0 leaks; `--repeat-each 3`: 36 of 36 passed, none retried.
- Run time for the 12 tests, the dev server's start and both builds included: 16.9 s (single run), 46.7 s for 36.
- Machine: Apple M3 Ultra, 96 GB, shared with other jobs (load average about 40 during the run), Chromium from
  Playwright.

Run it alone with `cd fixtures/app && FORGEBOOK_SHELL_GROUP=1/16 FORGEBOOK_SHELL_PORT=<port> pnpm test:shell
cssIsolation.e2e.ts` (the group starts only the fixture app's server, which this spec does not open).

## What one origin means in a static build

A static build keeps the frames on the catalogue's origin unless the configuration names two hosts
(`frames: { origins: { catalogue, frames } }`). For CSS this changes nothing: documents do not share style sheets
whatever their origin. For scripts it does: on one origin a story's code, or a value a shared link puts in a prop, can
read and change the catalogue's page and the other frames on it (the last row above). That matters for a catalogue
published where readers open links from others; a catalogue whose stories are all trusted code loses only the guard
against a mistake, such as a component that portals into `window.top.document`. Naming the frames' origin, two
subdomains serving the same files, gives the build what the dev server has by default.
