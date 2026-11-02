# bench

Forgebook says it is light and fast, so it has to show it. This command measures what a user actually gets, on a
generated library of components or on a real design system at a pinned commit, and with `--compare` runs Storybook and
Ladle on the same library through the same definitions. It is a repository tool: nothing here is published, and it adds nothing to the packages' install.

## What it measures

Forgebook is packed and installed in a work folder outside the repository, so nothing the repository installs can stand
in for a dependency a package forgot. In the workspace its packages are sources, served module by module,
which is not the program users run. A browser decides every time: a server that prints its address may still rebuild
its dependencies and reload the page. The time comes from the page itself, one animation frame after the element is
fully shown, by then painted, a fade included: waiting from outside would measure Playwright's retries, which land on a coarse grid.

| Metric | Definition |
|---|---|
| `coldStart` | process spawned → the first story visible, every cache removed |
| `sidebarReady` | process spawned → the name of the sidebar's last group in the page, same run |
| `warmStart` | as `coldStart`, caches kept |
| `hmrStory`, `hmrComponent` | a file written → the new text on screen |
| `componentPage` | page opened on a fresh server → every story of the component drawn |
| `firstPropsTable` | page opened on a fresh server → the props table visible |
| `serverMemory` | peak resident memory of the dev server's process tree, a start and a story's page |
| `serverMemoryDocs` | the same with a component's page, where the props are read |
| `serverMemoryCold` | as `serverMemory`, every cache removed first: a first start's peak, pre-bundling included |
| `build`, `buildSize` | the static build with no output and no cache, and the bytes of its output |
| `shellJs`, `frameJs` | JavaScript a first load of the build fetches, gzipped: by the top page, by the frames |
| `firstLoadJs` | the same in all, each file once: a chunk both fetch counts in both columns above |
| `searchJs` | JavaScript the first search fetches beyond a first load, gzipped: the list's code and the search index, each group's |
| `installSize` | `node_modules` on disk of a TypeScript project with Vite, React and the tool |
| `installAdded` | what the tool adds to that project, installed there: a tool with its own Vite keeps both |
| `packages`, `directDependencies` | the packages installed, and what the tool's main package declares |
| `storiesListed`, `storiesDrawn` | the stories the catalogue lists, and those whose frame drew, on a real library |

Times are the median and range of `--runs` samples; HMR has `--edits` samples and a p95, which needs at least 20 to mean
anything. A metric a tool cannot have is `n/a`, never a zero. A metric that fails is recorded, the run goes on, and the
command exits non-zero at the end.

## Being fair

- **The turns**: the tools take turns sample by sample, the order rotating, so a machine that gets busier does not land
  on one tool, and forward then backward, so no tool always follows the same one. Install and HMR run in a block per tool.
- **The story measured** sits in the middle of the library, at the end of a chain of four components. The start, HMR and
  page metrics load that story, so what the size of the library changes in them is the index, not the story.
- **Memory** is resident memory summed over the process tree, so a tool of several processes reads a little high.
- **The library** is generated without a clock or random numbers, so two machines measure the same files. It is a
  TypeScript project with a `tsconfig.json`, as the README describes one. Forgebook and Storybook get identical CSF 3
  stories. Ladle gets the same stories as functions with `.args`, without play functions,
  since it does not draw object stories; everything else is byte for byte the same.
- **Each tool** is configured as its documentation says, with a theme switch and nothing tuned for speed. Storybook has
  its docs addon, since Forgebook's pages are compared with its docs pages, and no version check: it would run on every
  cold start here, and a person pays it once a day.
- **Ladle brings its own Vite**, older than the one the other two run on. A comparison with it is partly a comparison of
  Vite versions, and anything published from it has to say so.
- **The versions** are pinned in `targets/<tool>/`, each with its own lockfile, outside the workspace, so the other tools
  never enter this repository's lockfile. Forgebook's own dependencies are whatever it declares, as a user gets them, and
  `installAdded` keeps the bare project locked while the tool's additions float. Update them by hand and regenerate the lockfile with
  `npm install --package-lock-only --ignore-scripts`.

## The machine

A timing is only as good as the machine's quiet. On macOS every group of metrics starts by reading the charger, the
thermal state, Time Machine, Spotlight and the idle CPU, and so does the end of the run; the readings go in the report
and anything suspicious is a warning. A noisy run is flagged, never silently kept. A cold start means the tool's caches
are cold, not the system's: its file cache cannot be emptied without root, and the first start after an install reads
higher than the rest.

`--throttle 4` slows the browser's CPU, for the metrics of a page. Node is not slowed, so the result is an indication of a
slow page and not of a slow computer.

`--against <report>` compares a run with an earlier one of the same corpus, machine and commit, and fails when a time's
median moved more than 10 % or a metric went missing, which is how the numbers are shown to be reproducible. Keep a copy
of the report: `report.json` is overwritten, and a run cannot be compared with itself.

## Real libraries

A generated library shows how a tool scales and nothing about what it cannot read. `--corpus <name>` runs on a public
design system at a pinned commit instead, a name under `corpora/` or a folder holding a `corpus.json`:

```sh
node tools/bench/bench.mts --corpus primer --compare --work /some/folder
```

- **Pinned.** A definition holds a full commit and an `https` repository, and refuses a branch, a tag or anything that
  would ask for credentials. The clone lands in `--work`, outside this repository, shallow and without large files.
- **Their code is data.** The clone runs no hook and installs with lifecycle scripts off. `prepare`, when a definition
  has one, is the only code of the library that runs before its stories, and only because those stories, or the
  library's own Storybook, import what it builds (Fluent's Storybook loads an addon of the monorepo from its build).
- **Forgebook** is packed as usual and installed in `.forgebook-bench`, inside the catalogue's folder, with the corpus's
  `forgebook.config.ts` and without React: a story and the frame have to share the library's one copy, so a library on
  an older React is measured on it. What the library's Storybook adds to its bundler is in that file, passed through the
  framework's plugins since the configuration has no key for Vite: comparing a tool with none of it would compare a page
  of errors.
- **Storybook**, with `--compare`, is the library's own: its version, its configuration, its addons, from its own install.
  Its builder is the library's choice, so these numbers say what that library's people wait for, not how two tools
  compare on equal terms: the generated library is for that. A library whose Storybook cannot run from the clone has none
  in its definition, and is measured with Forgebook alone. Ladle has no place here: it does not draw object stories.
- **Every story is opened.** The `sweep` group, first on a real library, starts a dev server, opens each story's frame and
  groups what fails by cause, in the report's `sweep`. A build that exits 0 says nothing about the stories.
- **`expected`** is what Storybook's own indexer counts at that commit, with the library's own globs. A run that lists
  fewer stories, or draws fewer than it lists, fails at the end with the difference; the timings are still in the report.
- **The install metrics** are absent: what the tool adds to a library is measured on the generated one.

Each report is `report-<name>.json` in `--work`. A corpus's edits write `bench-edit-<n>` into text the story shows, and put
the file back; a definition whose text is no longer in the pinned file fails on the first edit.

To add one: count its stories with Storybook's indexer on its own globs, pin the commit, write the definition, and move
what `viteFinal` does into its `forgebook.config.ts`.

## The budget

`--budget <file>` fails a run when a metric of Forgebook is over its limit, or was not measured: a check that passes by
losing its number protects nothing. The pull requests' `budget` job runs the light part of the benchmark (install, start
and build on 100 stories) against `budget.json`, on `ubuntu-latest`.

The limits are the numbers of that job on that runner, a little above: 2 % for sizes, so a small feature does not have to
reopen the budget and the dependencies that float do not fail an unrelated change; 50 % for times, which a shared runner
moves by that much. Sizes are what this check really holds. A limit moves in a pull request, in plain sight, with the
reason: raising one is a decision, not a chore.

## Following a run

`--status <file>` appends a JSON line per step, only between samples, so whatever follows the file cannot wake up during
a measurement. `tail -F` reads it from anywhere.

## The files

- `bench.mts`: the entry.
- `runBench.ts`: one benchmark, every metric of every tool.
- `measure.ts`: the measurements, the definitions above.
- `stamps.ts`: the time, taken inside the page.
- `targets.ts`: everything that differs between the tools.
- `corpus.ts`: the generated library, pure.
- `subject.ts`: what a measurement is taken on, for a generated library and a real one.
- `realCorpus.ts`, `realCorpus.types.ts`: a real corpus's definition, read and checked.
- `prepareCorpus.ts`: the clone, the library's install, Forgebook beside its stories.
- `sweep.ts`: every story opened in a browser.
- `corpora/`: the real libraries, one folder each.
- `prepare.ts`: packing, clean installs, the project on disk.
- `machine.ts`, `benchStats.ts`, `reportTable.ts`, `statusFile.ts`, `staticServer.ts`, `diskUsage.ts`: what they say.
- `budget.ts`, `budget.json`: the check of a pull request, and its limits.
- `targets/`: the pinned tools.

Everything it generates lands in `--work`, by default `forgebook-bench/` beside the repository; the last report is
`report.json` there.
