# bench

Forgebook says it is light and fast, so it has to show it. This command measures what a user actually gets, on a
generated library of components or on a real design system at a pinned commit, and with `--compare` runs Storybook and
Ladle on the same library through the same definitions. It is a repository tool: nothing here is published, and it
adds nothing to the packages' install.

## What it measures

Forgebook is packed and installed in a work folder outside the repository, so nothing the repository installs can stand
in for a dependency a package forgot. In the workspace its packages are sources, served module by module,
which is not the program users run. A browser decides every time: a server that prints its address may still rebuild
its dependencies and reload the page. The time comes from the page itself, one animation frame after the element is
fully shown, by then painted, a fade included: waiting from outside would measure Playwright's retries, which land on a coarse grid.

Forgebook's stories draw in frames on an origin of their own, which the catalogue's page cannot read. So the page's
script also runs inside each such frame and stamps what it draws there, and the catalogue's page stamps when the frame's
element was shown: a story counts as drawn at the later of the two, as it does when the frames share the catalogue's
origin and the page reads them directly. `--frames same-origin` measures Forgebook with `forgebook dev --frames same-origin`,
which keeps them there for one run without touching the catalogue's file, a real library's included; the report says
which was measured, and two reports of different modes are not compared.
Forgebook's dev server takes two ports then, its own and the frames', named on its command line so that a taken port
fails the sample instead of moving the frames onto the next tool's. A static build keeps the frames on the catalogue's
origin unless its configuration names two hosts, so `shellJs` and `frameJs` are read on one origin.

`--parity` measures Forgebook at parity with Ladle as it ships, which neither checks accessibility (it builds axe as an
empty module unless its a11y addon is on) nor reads props from the types: the generated catalogue's configuration sets
`a11y: false` and `componentDocs: false`, so `firstPropsTable` is `n/a`. The report's `features` says which ran
(`default` or `parity`), its tables head the column `forgebook at parity`, and two reports of different features are not
compared. Publish both columns, Forgebook as it is and at parity, beside Ladle's. A real library runs with its own
configuration, so `--parity` takes the generated library only.

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
| `shellJs`, `frameJs` | JavaScript a first load of the build fetches, gzipped: by the top page, by the frames; with the packed data (`.bin`) its modules fetch |
| `firstLoadJs` | the same in all, each file once: a chunk both fetch counts in both columns above |
| `searchJs` | JavaScript the first search fetches beyond a first load, gzipped: the list's code and the search index, each group's, which a build keeps packed (`.bin`) |
| `installSize` | `node_modules` on disk of a TypeScript project with Vite, React and the tool |
| `installAdded` | what the tool adds to that project, installed there: a tool with its own Vite keeps both |
| `packages`, `directDependencies` | the packages installed, and what the tool's main package declares |
| `storiesListed`, `storiesDrawn` | the stories the catalogue lists, and those whose frame drew, on a real library |

Times are the median and range of `--runs` samples; HMR has `--edits` samples and a p95, which needs at least 20 to mean
anything. A metric a tool cannot have is `n/a`, never a zero. A metric that fails is recorded, the run goes on, and the
command exits non-zero at the end. The report is written whole all the same, to its file and with `--json` to stdout,
with what went wrong in its `problems`: a failed metric, a time that did not reproduce, a limit passed, stories not
listed or not drawn.

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

A timing is only as good as the machine's quiet. Every group of metrics starts by reading the machine, and so does the
end of the run; the readings go in the report and anything suspicious is a warning. A noisy run is flagged, never
silently kept. Each system is read with what it has, and a reading it cannot give is left out:

- **macOS**: the charger, the thermal state, Time Machine, Spotlight on the volume, the idle CPU and the load.
- **Windows**: the mains or the battery, the idle CPU, the antivirus Windows knows and whether it scans files as they
  are opened, the CPU the antivirus, the indexer and Windows Update take, and the power plan. The shares come from
  two snapshots of the raw process counters a second apart, which read the same in every language of Windows.
- **Linux**: the mains or the battery, the idle CPU, the load, and the CPU the indexer (Tracker, Baloo), an antivirus
  (ClamAV) and the updates (apt, PackageKit) take, from `/proc` and `/sys`.

The report also names the system (`os`) on Windows and Linux, whose `system` is a kernel's number.

A cold start means the tool's caches are cold, not the system's: its file cache cannot be emptied without root, and the
first start after an install reads higher than the rest.

On Windows a package's command is a `.cmd` shim, which Node cannot start without a shell: the benchmark reads the shim
and runs its script with Node (`programs.ts`), so the server's process is Node itself. A server's tree is stopped with
`taskkill /T` there, and its memory is the working set summed over the tree, read by one PowerShell that stays open for
the measurement (`processes.ts`).

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
- **Their code runs, without your secrets.** The clone runs no hook and installs with lifecycle scripts off, but a
  library's code still runs: a repository that pins its package manager installs with the release file it holds,
  `prepare` builds what its stories import (Fluent's Storybook loads an add-on of the monorepo from its build), and the
  stories and the library's Storybook run during the measurements. So every command the harness starts gets only the
  variables a program needs (`toolEnvironment.ts`): no token or key of your environment or of CI's. A definition names
  a public `https` repository with no credentials, and every path it gives stays inside the clone.
- **Nothing written in the clone** but Forgebook's folder: every tool's build goes to `--work`'s `builds/<corpus>/<tool>`.
  A build inside the clone is read by the library's own tools: Fluent's Storybook lists the monorepo's projects, and
  stopped on a build folder (Storybook's own output holds a `project.json`, an Nx project's file).
- **Nothing left running.** Every command the harness runs in a library has its tools' daemons turned off (`NX_DAEMON`,
  `TURBO_DAEMON`), since a daemon such as Nx's, started by Fluent's `prepare`, keeps a core busy under every later run.
  At the end, interrupted or not, what the run started and is still alive is stopped: its own processes, and the
  daemons that detached from them and run from `--work`. Each is named in a warning. Two runs at once need a `--work`
  and a `--port` each.
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
- **`expected`** is what Storybook's own indexer counts at that commit, with the library's own globs. What the library's
  configuration leaves out, its definition leaves out too, with `!` patterns (Carbon's `forgebook.config.ts` reads the
  library's own list of them), so both tools index the same stories. A run that lists
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
a measurement. `tail -F` reads it from anywhere. Lines have three shapes:

- a sample about to be taken: `{"at", "tool", "metric", "run", "runs", "done", "total"}`, where `done` and `total`
  count the samples of the whole run;
- a long step outside the measurements, as it starts: `{"at", "state": "working", "activity", "tool"?}`, with
  `pack`, `install`, `clone` or `prepare`, and for the sweep every 25 stories with `"count"` and `"of"`, its stories:
  a reader can tell an install of an hour from a run that stopped;
- the end: `{"at", "state": "finished", "warnings"}`, the only line whose `state` means the run is over.

## Nothing waits forever

A run on a machine nobody watches must end, whatever goes wrong: a silent wait of hours costs the whole run. So every
wait has a deadline, and what it waited for is stopped with everything it started.

- **Programs** run to completion (installs, clones, a library's preparation, packing, builds, `ps`, PowerShell) go
  through `execProgram` (`programs.ts`), which needs a time limit and holds it for the whole process tree. A child that
  outlives the program and keeps its output open (an install script's, a build's worker) does not keep the call
  waiting: the program's exit ends it, and what it left is stopped. Running through cli-kit's `exec` alone, a timeout
  stops only the program, and the call then waits for its children.
- **Servers** are stopped with their tree and waited for, for 15 s at most (`processTree.ts`); each poll of a starting
  server has its own timeout.
- **Pages**: every reading of a frame (`stamps.ts`, `sweep.ts`) has a deadline, since a page whose script is stuck never
  answers Playwright's `evaluate`; closing a context or the browser has one too.
- **The machine's readings** give up after a minute (WMI can stall), and the reading is left out.

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
- `toolEnvironment.ts`: the variables a command gets, and the daemons turned off.
- `leftovers.ts`: what a run left running, found and stopped.
- `serverOutput.ts`: what a server printed, kept to say why it stopped: its first error and its last lines.
- `machine.ts`, `benchStats.ts`, `reportTable.ts`, `statusFile.ts`, `staticServer.ts`, `diskUsage.ts`: what they say.
- `programs.ts`, `processTree.ts`, `processes.ts`, `powershell.ts`, `deadline.ts`: how a program, a process tree and
  PowerShell are run on each system, and the deadlines of every wait.
- `kit/`: the bench kit, which installs and runs all this on a machine that has nothing (its own README).
- `budget.ts`, `budget.json`: the check of a pull request, and its limits.
- `targets/`: the pinned tools.

Everything it generates lands in `--work`, by default `forgebook-bench/` beside the repository; the last report is
`report.json` there.
