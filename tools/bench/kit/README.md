# bench kit

The benchmark, run by someone who is not a developer on a machine that has nothing installed: a Windows mini PC, a
Linux desktop. They copy this folder, double-click one file, answer two questions in Italian, and send back one zip.

## What it does

1. **Checks the machine**: 64-bit Windows 10 or 11, or Linux; 4 GB of memory and 6 GB of free disk to install, more for
   the full profile (`kitPlan.ts`, `requirements`).
2. **Installs into the user's own folder**, without administrator rights: `%LOCALAPPDATA%\ForgebookBench` on Windows,
   `${XDG_DATA_HOME:-~/.local/share}/forgebook-bench` elsewhere (`FORGEBOOK_BENCH_HOME` moves it). Node, and on
   Windows MinGit, from their projects' own sites, each checked against the SHA-256 in `kit.pins`; pnpm through
   corepack; Forgebook cloned over HTTPS at the commit `kit.pins` names; Playwright's Chromium. Every cache (npm, pnpm,
   corepack, Yarn, the browsers) stays in that folder, and Git reads no configuration of the user's and never asks for
   credentials. On Linux, Git comes from the system and Chromium's system libraries must be there: installing either
   needs an administrator, and the launcher says so with the command.
3. **Calibrates**: Forgebook alone, a start and a build on 100 stories, a few minutes. Its two phases, preparing
   (packing, installs) and measuring, scale the durations a reference machine recorded in `reference.json`, so each
   profile gets an estimate, shown as a range before the question.
4. **Asks the profile**: `quick` is the generated library of 500 stories with Forgebook, Storybook and Ladle; `full`
   adds Primer, Carbon and Fluent UI against their own Storybooks, and Spectrum on Linux. Spectrum is left out on
   Windows, and the kit says why: its Storybook builds its preview with Parcel on a fixed port (3000) and opens a Unix
   socket for its docs, and it was never tried there.
5. **Runs** each part as `bench.mts` with `--json --status`, its log kept, its progress shown when the status file
   changes. The machine is kept awake (`SetThreadExecutionState`, `systemd-inhibit`, `caffeinate`); the screen may
   sleep.
6. **Writes the results**: one zip on the Desktop with the reports, the kit's own summary (`kit.json`: profile, estimate
   and real durations, the machine's description) and the logs. Every text is cleaned first (`kitResults.ts`): the
   home folder becomes `~`, the user's and the computer's names placeholders, and a text where any is left stops the
   kit. The list of files and what they hold is shown before the question.

What it did is in `state.json`: launched again, it offers to resume a run that stopped, to start over, to write the
results of what is there, or to remove everything it installed (the launcher deletes the folder once Node exited).

## Running it

```sh
start-bench.cmd                        # Windows: double-click
bash start-bench.sh                    # Linux, macOS
start-bench.cmd --profile quick --yes  # no questions: the defaults, for a test
```

`--write-reference <file>` also writes the machine's durations in the shape of `reference.json`.

## Updating it

- **Forgebook's commit**: `forgebook.commit` in `kit.pins`, a full commit reachable on GitHub. The launchers run the
  kit's Node part from that commit, so a change to it ships by moving the pin.
- **Node and MinGit**: their version, address and SHA-256 in `kit.pins`, copied from `SHASUMS256.txt` and from the
  release's assets. Never a digest computed from a download.
- **The reference**: run the full profile with `--write-reference tools/bench/kit/reference.json` on a quiet machine,
  and keep its description in the file.

## The files

- `start-bench.cmd`, `start-bench.ps1`: the Windows launcher (the `.ps1` keeps a BOM and Windows line endings:
  Windows PowerShell reads a script without one as ANSI, and `cmd.exe` misreads bare line feeds).
- `start-bench.sh`: the launcher on Linux and macOS.
- `kit.pins`: what is downloaded, and the commit.
- `kit.mts`: the questions; `kitSession.ts` the folder, the state and the checks; `kitRunner.ts` the benchmark as a
  child process; `kitOutput.ts` the results file and the reference.
- `kitPlan.ts`, `kitState.ts`, `kitResults.ts`, `zipArchive.ts`: the logic, pure, tested in `kit.test.ts`.
- `reference.json`: the reference machine's durations.
