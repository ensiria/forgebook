# The generated story tests in a cold CI run

What `@forgebook/testing`'s generated browser suite costs in a CI job with no cache, on a library of 250 stories, and
whether any test fails only sometimes. Measured on 7 November 2026 at commit `1632ced4` of `develop`, plus the change
that adds retries in CI.

## How

```sh
node tools/cold-suite/cold-suite.mts --workers 4 --work /some/folder
node tools/cold-suite/cold-suite.mts --work /some/folder
```

The library is the benchmark's generated one: 50 components, 250 CSF 3 stories, one in ten with a play function, set up
word for word as the package's README says. Each run removes Vite's pre-bundle, Forgebook's index and `test-results`
first; the install and the browser are kept, as a CI job restores them. What the command does and reports is in
[its README](../tools/cold-suite/README.md).

The suite runs one test per story and variant (light, dark, both with more contrast, structure, narrow): 1500 tests.

## Machine

Apple M3 Ultra, 28 CPUs, 96 GiB, macOS, shared with other work: the one-minute load average was 30 to 50 during the
runs. A dedicated machine reads faster; these are numbers under load, not best cases.

## Results

With `cold-suite`, `CI` set, so retries on:

| workers | run 1 | run 2 | run 3 | test median | test p95 | passed |
|---|---|---|---|---|---|---|
| 4, a CI runner's count | 226.6 s | 232.4 s | 214.7 s | 509–559 ms | 800–939 ms | 1500/1500 each |
| 28, the suite's default (one per CPU) | 101.4 s | 98.8 s | 120.0 s | 1539–1920 ms | 2387–3347 ms | 1500/1500 each |

Before the change, by hand with the same setup and no retries: 4 workers 263 s, 299 s, 242 s; 28 workers 145 s, 177 s,
161 s. The wall time includes starting the frame page's Vite server and its first pre-bundle.

Report sizes, the same in every run within 0.1 %:

| output | size |
|---|---|
| the `list` reporter's output, what a CI log holds | 186 KiB (about 127 bytes a test) |
| a JSON report (`--reporter=json`) | 1.71 MiB |
| `test-results` on a green run | 45 bytes (`.last-run.json`) |

## Flakiness

Twelve cold runs of 1500 tests, 18,000 tests in all. One failed, once, in a run at 28 workers with the machine's load
at 46: `Forms/Widget49 › Story 4 · structure` failed in 129 ms with `browserContext.newPage: Target page, context or
browser has been closed`, before the story opened. Run again alone it passed in 838 ms. The browser was lost, not the
story: nothing in the story or the checks ran.

The suite had no retries, so that one lost browser failed the job. `storyTestConfig` and `visualTestConfig` now retry a
failed test twice when `CI` is set, as Playwright's own template does, and never on a developer's machine; a test that
passes on a retry is reported as flaky, and `retries` in `testServer.ts` sets another count. The six runs after the
change had no failure and no retry.

## Not measured

- A real CI runner (GitHub's Linux runners): the 4-worker row stands in for one, on a faster CPU.
- Windows and Linux.
- The server-render suite (Vitest) and the visual tests (Docker).
- A library over 250 stories; the time grows with the tests, about 0.15 s of wall time per test at 4 workers here.
