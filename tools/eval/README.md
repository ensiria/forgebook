# eval

Forgebook says a coding agent that has it does better UI work. Nobody has published a blind measure of that for any
tool, so this command is how to find out, and how anyone can check the answer. It runs a coding agent on real UI tasks
in real open source apps, once in a copy of the app where `forgebook init --agents` ran and once in the app as it is,
measures both changes the same way, and prepares the material for people to score them without knowing which is which.
It is a repository tool: nothing here is published, and it adds nothing to the packages' install.

The harness calls no model and holds no key. It starts whatever agent CLI a profile names, with that CLI's own login.
`--agent dry-run` is a stand-in that applies scripted edits instead, to prove the pipeline for nothing; its numbers
say nothing about Forgebook.

## The tasks

`tasks/<id>/task.json`, each on an app of `apps/<name>.json` pinned to a full commit. A task is what a person would ask
an agent for, word for word the prompt in both arms, and everything it is judged on is written before any run:

- **`constraints`**: the five every task states, for that task: `reuse` (the app's existing components), `tokens` (no
  value typed by hand), `states` (empty, long, narrow, dark, errors), `a11y`, `scope` (nothing else changed or broken).
  The judges read them on every pair.
- **`states`**: the screens to picture, each reached by steps on the app's dev server, in a desktop or a 360 px window,
  light or dark.
- **`acceptance`**: steps with expectations that pass only if the change works. Their texts are the ones the prompt
  asks for, so they say nothing of how the agent built it.
- **`scope`**: the files a change is expected in. A product file beyond it is counted.
- **`probes`**: where the prompt fixes a component's API, stories written in advance for it (`password-strength`). They
  are never shown to an agent and give `verify` and the stress matrix the same thing to check in both arms.

The prompt of both arms ends with the same line, asking for `RESULT: done` or `RESULT: not done: <why>` as the last line,
so the claim is read the same way for every agent.

| App | Framework | Tasks |
|---|---|---|
| [shadcn-admin](https://github.com/satnaing/shadcn-admin) | React, Vite, shadcn/ui, Tailwind 4 | 4 |
| [next-shadcn-admin-dashboard](https://github.com/arhamkhnz/next-shadcn-admin-dashboard) | Next.js 16, shadcn/ui | 4 |
| [nuxt-shadcn-dashboard](https://github.com/dianprata/nuxt-shadcn-dashboard) | Nuxt 4, shadcn-vue | 4 |

All three are MIT-licensed, run on mock data with no backend or account, and have a component library of their own,
which is what the `reuse` and `tokens` constraints need.

## One run

1. **The arms' bases**, made once per app: `without`, the clone at its commit, installed with lifecycle scripts off;
   `with-<hooks>`, the same after Forgebook's packages are added and `forgebook init --agents --browser --draw` ran with
   the profile's `hooks`, so the agent is held by its own loop; `measure`, Forgebook set up without the agents' files.
2. **The agent** works in a copy of its arm's base, with the prompt and nothing else: no terminal, a time limit, its own
   login (the variables its profile names, and `HOME`), no other variable of the environment. What it started is stopped
   when it ends.
3. **Its change** is committed by the harness and taken as a diff from its base, so the set-up is never counted as the
   agent's. Files are sorted into product, tests, stories, set-up and lockfiles.
4. **The measurement** applies that diff to a copy of `measure` with the task's probes committed, and runs everything
   there, both arms alike: the states pictured and checked with axe (the copy Forgebook's checks run), the acceptance
   checks, `forgebook verify --since HEAD` in every variant, `forgebook check-code`, the stress matrix on the probes, and
   the app's own type check, tests and linter. A check already red on the app as cloned is reported as such, never as the
   agent's failure.

Each run's folder, `<work>/runs/<task>--<arm>--<repeat>/`, holds `prompt.md`, the agent's output, `diff.patch` (what the
judges read), `full.patch`, `states/*.png`, Forgebook's documents and `measures.json`. A run that fails says why in
`failed.txt` and the others go on; a run already measured is kept, so an evaluation starts again where it stopped.

## The measures

| Measure | What it says |
|---|---|
| `working` | every acceptance check, the type check and the tests passed |
| `outcome` | the claim against `working`: `done-and-working`, `claimed-but-broken`, `honest-not-done`, `working-unclaimed`, `broken-no-claim` |
| `acceptance` | each check, with why it failed |
| `checks` | the app's type check, tests, linter: passed, failed, failing at base, absent |
| `states` | each picture, and axe's violations by rule |
| `verify`, `checkCode`, `stress` | Forgebook's verdicts, or why one could not run (a release without the stress matrix says so) |
| `files` | product files, stories and tests, set-up files, files outside the scope, lines added and removed |

`score` compares the arms task by task: each measure's mean per arm, and with minus without averaged over tasks, with a
95 % interval from a bootstrap over tasks. A measure a run could not take is left out, never counted as zero.

## Blinding

`blind` turns the measured runs into three folders, so the key never travels with the kit:

- `kit/`, for the judges: `README.md` (the instructions of `judges/instructions.md`), one page per pair with the
  request, the constraints, both sides' pictures side by side and both diffs, and one sheet per judge.
- `blind/runs/<code>/`, each run's pictures, diff and measures with its id, arm, agent, stories and set-up files taken
  out, for whoever prepares the analysis.
- `<work>/key/key.json`, outside the judging folder, which side is which. Its SHA-256 is printed in the kit before any
  score comes back.

The codes, the sides and the sheets' orders are drawn from the system's secure random source, never from `--seed`: a
judge who knew a seeded generator could search the seeds until the codes matched, and read every side's arm.

Judges see the product and its tests only: a story file alone would say which arm wrote it. Every word naming the tool
left in a diff is replaced, and counted (`redactions`). A replacement can itself hint at the arm, so pairs with one are
reported apart in the analysis. Each judge
gets the pairs in an order of their own, and two pairs again with their sides swapped, to measure consistency. The
sheet asks which side had the tool; the share guessed right says whether the conditions were hidden.

## The judges' result

Fixed before any score:

- **Primary outcome**: the mean `overall` score, on -2 to 2, turned so a positive one favours the arm with Forgebook,
  over every pair and judge. Its 95 % interval comes from a crossed bootstrap that draws tasks and judges again with
  replacement (a task's repeats are not independent; judges differ), and its p-value from a sign-flip test over tasks.
- **Secondary**: the win rate (ties counted half), each criterion, the share of sides judges would merge as they are,
  by arm.
- **Quality of the judging**: Krippendorff's alpha on `overall`, each judge's consistency on the repeated pairs, and the
  share of right guesses of the arm (near 0.5, or mostly `unsure`, means the blinding held).

`score` also says how many runs failed in each arm: a failed run is in no pair and no mean, so failures that land on
one arm would bias everything else. A null result is a result, and is published as one.

## How many

`node tools/eval/eval.mts plan` gives the sample a result needs (normal approximation to the binomial, inflated by the
design effect of repeats). It sizes the win rate, a simpler statistic than the primary outcome; the mean score uses the
same judgements with their strength, so a plan sized on the win rate is, if anything, cautious. With the defaults, a win rate of 0.65 to detect, repeats as alike as an intraclass
correlation of 0.3, a two-sided level of 0.05 and a power of 0.8:

| Win rate to detect | Independent pairs | Pairs, 3 repeats | Tasks |
|---|---|---|---|
| 0.75 (large) | 29 | 47 | 16 |
| 0.70 | 47 | 76 | 26 |
| 0.65 | 85 | 136 | 46 |

So the 12 tasks here, run 3 times in each arm, give 36 pairs: enough to see a large effect (a win rate around 0.75 or
more), not a modest one. To see 0.65, write tasks up to about 46, which is the path the format makes cheap. Judges:
at least 3 per pair, 5 recommended, each scoring every pair, so each pair's score averages out one judge's taste and
alpha can be computed. At about 4 minutes a pair, 36 pairs plus 2 repeated take a judge about 2.5 hours; 136 pairs take
about 9, which is better split into sessions. Judges should be people who review UI pull requests, and none should
have worked on Forgebook.

## Running it

```sh
node tools/eval/eval.mts tasks                                   # check every definition
node tools/eval/eval.mts run --agent dry-run --repeats 1 \
  --task apps-empty-state --task password-strength --work /tmp/eval   # the pipeline, no model
node tools/eval/eval.mts run --agent claude-code --work /tmp/eval  # every task, 3 times in each arm
node tools/eval/eval.mts blind --work /tmp/eval --judges 5
node tools/eval/eval.mts score --work /tmp/eval --key /tmp/eval/key/key.json --sheets <filled sheets>
```

`--seed` orders the runs and seeds the bootstrap; it never touches the blinding. Each run records the agent, the
Forgebook build (`sha256:` of the packed tarballs, or the release's version) and a fingerprint of its definition: a run
made under any other is run again, never resumed, and `blind` refuses a work folder that mixes agents or builds. Give
each agent and each build a `--work` of its own. `--forgebook-version` evaluates a published release instead of this
checkout, packed. `--port` sets the first of the
three ports a measurement takes; two evaluations at once need their own `--work` and `--port`. `--keep` keeps each run's
copies of the app, to look into one.

## Agents

A profile in `agents/<name>.json`, or any file: `command` with placeholders (`{prompt}`, `{promptFile}`,
`{workspace}`, `{evalDir}`), `env` (the variables the CLI logs in with), `timeoutMinutes`, and `hooks` (what
`init --agents --hooks` writes in the arm with Forgebook). A real agent's command may not name `{arm}` or `{task}`: it
never learns its arm or reads the task's checks. `claude-code.json` is tried here as far as its flags; `codex.json`
(no approval, no sandbox, since its sandbox has no network for the dev server) and `gemini.json` follow those CLIs'
documentation and are not tried.

An agent run this way edits files and runs commands without asking, and could read other runs' outputs in the work
folder. Run the evaluation in a virtual machine or a container with nothing of yours in it, and a fresh install of the
agent: it keeps its own `HOME` to log in, so a skill, MCP server, hook or instruction file in its global configuration
(`~/.claude`, `~/.codex`, `~/.gemini`) would reach both arms, and one about Forgebook would contaminate the arm without
it. Claude Code refuses `bypassPermissions` as root unless the container sets `IS_SANDBOX=1`. The agent's folder and
its prompt file have random names, its copy's history uses a neutral identity, and nothing in the arm without
Forgebook names it.

## Their code runs

The clones run no Git hook and install with lifecycle scripts off, but their code still runs: their dev servers, their
tests, the agents' commands. Every command of an app gets only a program's variables (`toolEnvironment`), never the
tokens of the environment. It keeps `HOME`, since a package manager takes its version and settings from there and an
install with another home is not the one the app's people run, so files under it, such as
`~/.npmrc`, are readable by the apps' code: one more reason for a machine of its own. Playwright's browsers go in `<work>/browsers`, since its install removes the browsers of a folder that
no installed Playwright names. After the agent ends, its copy's Git configuration is put back from the base and Git
runs with no hook, monitor, external diff or text conversion, so nothing the agent wrote runs then.

## Files

| File | What |
|---|---|
| `eval.mts` | the command: `tasks`, `run`, `blind`, `score`, `plan` |
| `definitions.ts` | apps, tasks and profiles read and checked |
| `runEval.ts`, `runOne.ts` | the runs, and one run end to end |
| `workspace.ts`, `forgebookSetup.ts` | the bases, and Forgebook set up as a user would |
| `agentRun.ts`, `servers.ts` | the agent, and the dev servers |
| `pageRun.ts`, `forgebookMeasures.ts`, `appChecks.ts` | the pictures, axe and acceptance; Forgebook's verdicts; the app's checks |
| `changedFiles.ts`, `outcome.ts` | the change's files and the judges' diff; the claim |
| `blindPairs.ts`, `blindKit.ts` | the pairs and the key; the kit |
| `score.ts`, `measuresSummary.ts`, `stats.ts` | the judges' result; the measures by arm; the statistics |
| `judges/instructions.md` | the judges' instructions, scale and criteria |
| `dry-run-agent/` | the stand-in |
