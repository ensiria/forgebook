# bench

Forgebook says it is light and fast, so it has to show it. This command measures what a user actually gets, on a
generated library of components, and with `--compare` runs Storybook and Ladle on the same library through the same
definitions. It is a repository tool: nothing here is published, and it adds nothing to the packages' install.

## What it measures

Forgebook is packed and installed in a clean folder. In the workspace its packages are sources, served module by module,
which is not the program users run. A browser decides every time: a server that prints its address may still rebuild
its dependencies and reload the page.

| Metric | Definition |
|---|---|
| `coldStart` | process spawned → the first story visible, every cache removed |
| `sidebarReady` | process spawned → the sidebar's last group visible, same run |
| `warmStart` | as `coldStart`, caches kept |
| `hmrStory`, `hmrComponent` | a file written → the new text on screen |
| `componentPage` | page opened on a fresh server → every story of the component drawn |
| `firstPropsTable` | page opened on a fresh server → the props table visible |
| `serverMemory` | peak resident memory of the dev server's process tree, a start and a page visit |
| `build`, `buildSize` | the static build from nothing, and the size of its output |
| `shellJs`, `frameJs` | JavaScript a first load of the build fetches until the story shows, gzipped; top page and frames |
| `installSize`, `installAdded` | `node_modules` on disk: the total, and what it adds to a project with Vite and React |
| `packages`, `directDependencies` | the packages installed, and what the tool's main package declares |

Times are the median and range of `--runs` samples; HMR has `--edits` samples and a p95, which needs at least 20 to mean
anything. A metric a tool cannot have is `n/a`, never a zero. A metric that fails is recorded, the run goes on, and the
command exits non-zero at the end.

## Being fair

- **The library** is generated without a clock or random numbers, so two machines measure the same files. Forgebook and
  Storybook get identical CSF 3 stories. Ladle gets the same stories as functions with `.args`, since it does not draw
  object stories; everything else is byte for byte the same.
- **Each tool** is configured as its documentation says, with a theme switch and nothing tuned for speed. Storybook has
  its docs addon, since Forgebook's pages are compared with its docs pages.
- **Ladle brings its own Vite**, older than the one the other two run on. A comparison with it is partly a comparison of
  Vite versions, and anything published from it has to say so.
- **The versions** are pinned in `targets/<tool>/`, each with its own lockfile, outside the workspace, so the other tools
  never enter this repository's lockfile. Update them by hand and regenerate the lockfile with
  `npm install --package-lock-only --ignore-scripts`.

## The machine

A timing is only as good as the machine's quiet. On macOS every tool's measurements start by reading the charger, the
thermal state, Time Machine, Spotlight and the idle CPU; the readings go in the report and anything suspicious is a
warning. They are recorded on purpose: a noisy run is flagged, never silently kept.

`--throttle 4` slows the browser's CPU, for the metrics of a page. Node is not slowed, so the result is an indication of a
slow page and not of a slow computer.

`--against <report>` compares a run with an earlier one and fails when a time's median moved more than 10 %, which is how
the numbers are shown to be reproducible.

## Following a run

`--status <file>` appends a JSON line per step, only between samples, so whatever follows the file cannot wake up during
a measurement. `tail -F` reads it from anywhere.

## The files

- `bench.mts`: the entry.
- `runBench.ts`: one benchmark, every metric of every tool.
- `measure.ts`: the measurements, the definitions above.
- `targets.ts`: everything that differs between the tools.
- `corpus.ts`: the generated library, pure.
- `prepare.ts`: packing, clean installs, the project on disk.
- `machine.ts`, `benchStats.ts`, `reportTable.ts`, `statusFile.ts`, `staticServer.ts`, `diskUsage.ts`: what they say.
- `targets/`: the pinned tools.

Everything it generates lands in `.bench/`, ignored by git; the last report is `.bench/report.json`.
