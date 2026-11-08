# cold-suite

Storybook's test runner is slow or red in CI for many teams, and it is the area with the most new reports there.
`@forgebook/testing` is built differently: a Playwright test per story and variant, generated from the stories. This
command says what that costs in a CI job with no cache, on a library of a few hundred stories, and whether any test
fails only sometimes. It is a repository tool: nothing here is published.

## What it does

1. Packs this checkout's `forgebook`, `@forgebook/story-format`, `@forgebook/react` and `@forgebook/testing`, as the
   benchmark does (`../bench/prepare.ts`), so the run uses what users install and not the workspace's sources.
2. Writes the benchmark's generated library (`../bench/corpus.ts`, 50 components and 250 stories by default) in the work
   folder, with the setup of `@forgebook/testing`'s README: the source module and the six files of `test/stories/`,
   word for word but for the names and the ports. A test checks that the spec and the configuration still match the
   README.
3. Installs it with npm, lifecycle scripts off, and the browser with `forgebook browser`.
4. Runs the suite `--runs` times. Before each run it removes what a CI job without a cache lacks: Vite's pre-bundle and
   Forgebook's index (both in `node_modules/.vite`) and `test-results`. The install and the browser are kept, as a CI job
   restores them or pays them once.
5. After a run with failures, runs them again alone (`--last-failed`). A test that then passes is **flaky**; one that
   fails again is **broken**. Either fails the command.

## What it reports

Per run: the wall time of `playwright test`, the frame page's server start included; the tests and how many passed; one
test's median and 95th percentile time (first tries); the bytes of the JSON report, of what the `list` reporter printed
(the reporter the suite's configuration names, which is what a CI log holds) and of `test-results`. The report is written
to `report.json` in the work folder, and with `--json` to stdout.

The suite runs one test per story and variant: light, dark, both with more contrast, structure and narrow, so 250
stories are 1500 tests. Workers default to one per CPU, the suite's own setting; `--workers 4` is a CI runner with four.

## Reading the numbers

The time is the machine's as much as the suite's: a shared or busy machine reads slower, and the load average before the
first run is in the report. A number to publish names the machine, the workers and the commit, all in the report.

## Files

- `cold-suite.mts`: the command.
- `coldSuite.ts`: the setup's files and what a Playwright JSON report says, pure; `coldSuite.test.ts` tests it.
- `coldSuiteRun.ts`: the pack, the install and the runs.
- `coldSuite.types.ts`: the report's shape.
