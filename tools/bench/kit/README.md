# bench kit

The benchmark, run by someone who is not a developer on a machine that has nothing installed: a Windows mini PC, a
Linux desktop. They copy this folder, double-click one file, answer two questions in Italian, and send back one zip.

## What it does

1. **Checks the machine**: 64-bit Windows 10 or 11, or Linux; 4 GB of memory and 6 GB of free disk to install, more for
   the full profile (`kitPlan.ts`, `requirements`).
2. **Installs into the user's own folder**, without administrator rights: `%LOCALAPPDATA%\ForgebookBench` on Windows,
   `${XDG_DATA_HOME:-~/.local/share}/forgebook-bench` elsewhere (`FORGEBOOK_BENCH_HOME` moves it, and
   `FORGEBOOK_BENCH_DESKTOP` the results file). Node, and on Windows MinGit, from their projects' own sites, each
   checked against the SHA-256 in `kit.pins`; pnpm through corepack; Forgebook cloned over HTTPS at the commit
   `kit.pins` names; Playwright's Chromium. Every cache (npm, pnpm, corepack, Yarn, the browsers) stays in that folder,
   Git reads no configuration of the user's and never asks for credentials, and no tool asks a question: corepack's
   download prompt is off and every program the launchers run reads an empty stdin. On Linux, Git comes from the
   system and Chromium's system libraries must be there: installing either needs an administrator, and the launcher
   says so with the command. On Windows, the Visual C++ runtime that Storybook's and Ladle's native modules load is
   missing from a fresh system: the launcher installs Microsoft's own package (hash pinned, signature checked), the one
   step that asks for an administrator. The request waits 10 minutes at most, in a helper process of its own since
   asking for elevation blocks whoever asks; refused or unanswered, the kit goes on without those two tools.
3. **Calibrates**: Forgebook alone, a start and a build on 100 stories, a few minutes. Its two phases, preparing
   (packing, installs) and measuring, scale the durations a reference machine recorded in `reference.json`, so each
   profile gets an estimate, shown as a range before the question. Measuring scales by the calibration's build when
   both machines built: a phase holding a failed metric's timeout says nothing of the machine's speed.
4. **Asks the profile**: `quick` is the generated library of 500 stories with Forgebook, Storybook and Ladle; `full`
   adds Primer, Carbon and Fluent UI against their own Storybooks, and Spectrum on Linux. Spectrum is left out on
   Windows, and the kit says why: its Storybook builds its preview with Parcel on a fixed port (3000) and opens a Unix
   socket for its docs, and it was never tried there. Every question comes before the run: none waits for an answer
   after it started.
5. **Runs** each part as `bench.mts` with `--json --status`, its log kept, watched (below). The machine is kept awake
   (`SetThreadExecutionState`, `systemd-inhibit`, `caffeinate`); the screen may sleep. After each part, and at each
   launch, whatever a benchmark that crashed left running from the kit's own folders is stopped (the benchmark's
   `leftovers.ts`): a server left behind would hold its port and its CPU.
6. **Writes the results**: one zip on the Desktop with the reports, the kit's own summary (`kit.json`: profile, estimate
   and real durations, why a part was stopped, the machine's description) and the logs. Every text is cleaned first
   (`kitResults.ts`): the home folder becomes `~`, and so does any user's folder in any spelling (Windows' short
   `MARIOR~1` included), the user's and the computer's names and a OneDrive folder's organisation become placeholders,
   and a text where any is left stops the kit. Messages name the results file without its folder. The list of files and what they hold is shown as it is written; nothing is asked, since
   writing a file on the Desktop sends nothing anywhere.

What it did is in `state.json`: launched again, it offers to resume a run that stopped, to start over, to write the
results of what there is, or to remove everything it installed (the launcher deletes the folder once Node exited).

## Never silent, never stuck

A run of the full profile was reported from the field on an x64 mini PC: estimated at 4 h 22 min at most, still a
blinking cursor after more than eleven hours, with no error and no log. Whatever the cause there, the kit now makes
that impossible to repeat in silence, at every level:

- **The console.** The Windows launcher turns the console's QuickEdit and Insert modes off for its window, and back as
  they were at the end. With QuickEdit on, a click in the window selects text and suspends every program writing to
  the console until a key is pressed, without a sign: the kit's Node process then blocks on its next line.
- **A line every minute.** While a part runs, the kit says where it is: `Ancora in corso, Primer (GitHub): misuro
  forgebook · hmrStory, passo 112 di 340 (32%); da 37 minuti.` The launchers do the same for their own long steps.
- **Git** gets its settings from the kit's own configuration file (long paths, and a transfer slower than 1 kB/s for
  five minutes given up), never from `GIT_CONFIG_COUNT`, which the benchmark does not pass on to the tools it runs.
- **Deleting** the kit's folder («Cancella tutto») happens only for a folder holding the kit's marker file, never the
  user's own folder or a drive, whatever `FORGEBOOK_BENCH_HOME` says.
- **Watchdogs.** The kit looks at the run's log and status file every 15 seconds, by their sizes alone, and reads the
  status file only when it grew, which happens only between measurements (`kitRunner.ts`). The benchmark writes a
  status line before each sample and at the start of each long step outside the measurements (packing, each install,
  the fetch and the checkout of a library, each command of its preparation, every 25 stories of the sweep, every 5
  edits of a group of edits). A run silent past what its phase allows (15 minutes
  starting, 100 preparing, 30 sweeping or measuring) or past its part's limit (three times its estimate, two hours at
  least) is stopped with its whole process tree, the reason goes in `kit.json` and the console, and the kit goes on
  with the next part (`kitWatch.ts`). The launchers stop a step of their own the same way (an install silent for
  30 minutes, a fetch for 20, each with an upper limit too).
- **The benchmark itself** never waits forever (its README, "Nothing waits forever"): every program it runs to
  completion has a time limit that holds for its whole tree, every stop of a server and every reading of a page has a
  deadline, and the machine's readings give up after a minute. The kit's limits sit above the benchmark's own, so a
  step the benchmark can end itself ends there first, with its reason in the report.
- **Logs on disk as they happen**, in the kit's `logs` folder: `launcher.log` (the launcher's lines, with the time),
  `launcher-NN.log` (each program it ran), `kit.log` (every line the kit said, written before it is printed),
  `calibration.log` and one log per part (the benchmark's output).
- **What there is, sent back.** When a step fails, the kit writes the results file of what there is before it reports
  the failure; before Node is installed the Windows launcher zips its own logs, cleaned and checked the same way (the
  Linux launcher then only says where they are). Launched again,
  the menu offers «Crea il file dei risultati con quello che c'è»; `start-bench.cmd --results` (or `bash
  start-bench.sh --results`) does only that.

### The hang's likely causes, and what fixed each

Read in the code of the kit's earlier version (the field run's logs were not available):

| Cause | Where | Fix |
|---|---|---|
| QuickEdit: a click in the window suspends every write to the console | the Windows console | the launcher turns it off |
| A program's time limit stopped only the program, then waited for its output pipes, which a child holding them (an install script's, a build's worker) keeps open: forever on Windows, where stopping a process leaves its children running | cli-kit's `exec`, under every install, clone, preparation and build | `execProgram` stops the tree and ends at the program's exit (`programs.ts`); reproduced on macOS: a 2 s limit returned after the child's 12 s |
| Most programs had no time limit at all: a stalled `npm install`, `yarn install` or `git fetch` waits forever | `prepare.ts`, `prepareCorpus.ts` | every one has a limit; Git gives up on a transfer slower than 1 kB/s for five minutes |
| A frame whose script is stuck never answers Playwright's `evaluate`, which has no timeout, and the loop that waits for a story reads every frame | `stamps.ts`, `sweep.ts` | each reading has a deadline |
| Stopping a server waited for its exit without a limit; on Windows `taskkill` can fail | `measure.ts` | 15 s, then the run goes on |
| WMI can stall, and the machine's readings and the Windows memory sampler read it | `machine.ts`, `processes.ts` | a minute at most, then the reading is missing |
| The kit waited for the benchmark without a limit, and said nothing while a step took long | `kitRunner.ts` | watchdogs and a line every minute |
| The request for an administrator's permission waits until someone answers | the Visual C++ step | 10 minutes in a helper process, then on without it |
| The results file asked for a confirmation at the end of the run | `kitOutput.ts` | written without a question |

## Running it

```sh
start-bench.cmd                        # Windows: double-click
bash start-bench.sh                    # Linux, macOS
start-bench.cmd --profile quick --yes  # no questions: the defaults, for a test
start-bench.cmd --results              # only the results file of what there is
```

`--write-reference <file>` also writes the machine's durations in the shape of `reference.json`.

## Updating it

- **Forgebook's commit**: `forgebook.commit` in `kit.pins`, a full commit reachable on GitHub. The launchers run the
  kit's Node part and the benchmark from that commit, and measure the Forgebook packed from it, so a change to either
  ships by moving the pin, and a pin must hold this folder's Node part and the benchmark's Windows support.
- **Node and MinGit**: their version, address and SHA-256 in `kit.pins`, copied from `SHASUMS256.txt` and from the
  release's assets. Never a digest computed from a download. Node is 24.14.0: in 24.22.2 the `fetch` the harness polls
  servers with throws `setTypeOfService EINVAL` from a socket on macOS halfway through the generated library, and the
  run dies with its servers and browser left running; 24.14.0 is also what the reference numbers were measured with.
- **The reference**: run the full profile with `--write-reference tools/bench/kit/reference.json` on a quiet machine,
  and keep its description in the file. The one here was recorded before the benchmark's frames moved to an origin of
  their own and before the sweep, so estimates are a little off; it has no Spectrum (another program held port 3000 on
  the machine that recorded it), so Linux's full estimate leaves Spectrum out and says so.

## What has been verified, and what has not

On the kit's earlier version (Forgebook at an older commit, the same launchers before the watchdogs):

- **Windows 11 ARM64** (a VM, standard user, from nothing): installation, calibration, the quick profile with every
  metric of the three tools, the results file free of the user's and the computer's names, a resumed run, «Cancella
  tutto». Two faults seen only on Windows were fixed then: Storybook and Ladle died at once without the Visual C++
  runtime (`ERR_DLOPEN_FAILED` in oxc-resolver's and Rollup's native modules), and Node failed an assertion reading the
  long window title Windows gives a console (`process_title`), hence the short title.
- **Linux** (Debian 12 ARM64 in a container, standard user): the check of Chromium's libraries, then calibration, the
  quick profile and the results file.
- **macOS**: the reference durations.

Never run: **Windows x64** (the field PC is the first), the **full profile on Windows** (Primer, Carbon and Fluent UI
there: large Yarn installs, long paths, Fluent's `prepare` with MinGit's `sh`), the Visual C++ permission request on a
real PC, a Desktop moved to OneDrive, an antivirus other than Defender, Linux on a desktop with a session.

On this version, see the pull request that brought it to `develop` for what was run and where.

## The files

- `start-bench.cmd`, `start-bench.ps1`: the Windows launcher (the `.ps1` keeps a BOM and Windows line endings:
  Windows PowerShell reads a script without one as ANSI, and `cmd.exe` misreads bare line feeds).
- `start-bench.sh`: the launcher on Linux and macOS.
- `kit.pins`: what is downloaded, and the commit.
- `kit.mts`: the questions; `kitSession.ts` the folder, the state and the checks; `kitRunner.ts` the benchmark as a
  watched child process; `kitWatch.ts` what the watch reads and decides; `kitJournal.ts` the journal;
  `kitOutput.ts` the results file and the reference.
- `kitPlan.ts`, `kitState.ts`, `kitResults.ts`, `zipArchive.ts`: the logic, tested in `kit.test.ts`; the watch in
  `kitWatch.test.ts` and `kitRunner.test.ts`.
- `reference.json`: the reference machine's durations.
