# A component page of 50 stories, against Storybook's docs page

What a reader waits for and what the browser holds on one long documentation page: a component with 50 stories, in
Forgebook and in Storybook, from the dev server and from a static build.

## How it was measured

- **The stories**: the benchmark's generated library with ten components of fifty stories each
  (`node tools/bench/bench.mts --compare --components 10 --stories 500`), the same CSF 3 files for both tools. The page
  measured is `Media/Widget7`.
- **The tools**: Forgebook packed from `develop` at `1632ced4`; Storybook 10.6.5 with `@storybook/react-vite` and its
  docs addon, as `tools/bench/targets/storybook` pins it. Each served its dev server, then its static build behind the
  benchmark's static server (`tools/bench/staticServer.ts`).
- **The browser**: Playwright's Chromium, headless, a 1280 × 900 window. A story counts as drawn when its
  `[data-bench="label"]` element is in a document, read in every frame.
- **The machine**: Apple M3 Ultra, 96 GB, macOS, **shared and loaded** while measuring (load average around 20, the
  benchmark's own reading 4 % idle, Spotlight indexing). Read the numbers as an order of magnitude and a direction, not
  as a published benchmark: the quiet reference machine has not measured them.

| Column | Meaning |
|---|---|
| first story | page opened → the first story drawn |
| first screen | page opened → the last story drawn without scrolling, once nothing new arrived for 3 s |
| stories at first | how many stories that is |
| all, scrolling | from the end of the first screen, the wheel turned 600 px every 100 ms until all 50 are drawn |
| long tasks | main-thread time past 50 ms per task until the first screen, summed over the page and its frames |
| browser memory | resident memory of the browser's process tree: at the first screen / with all 50 drawn |
| DOM nodes | nodes of the page and every frame, with all 50 drawn |

## Numbers

Static build, three visits each (median, range):

| | first story | first screen | stories at first | all, scrolling | long tasks | browser memory | DOM nodes |
|---|---|---|---|---|---|---|---|
| Forgebook, before | 240 ms (239–357) | 402 ms (312–545) | 5 | 3.9 s (3.5–4.8) | 0 ms | 422 / 629 MB | 6,825 |
| Forgebook, after | 241 ms (143–344) | 315 ms (269–438) | 5 | 4.2 s (4.0–4.9) | 0 ms | 416 / 611 MB | 5,288 |
| Storybook | 702 ms (687–976) | 781 ms (762–976) | 50 | at once | 218 ms (210–278) | 546 / 465 MB | 3,212 |

Dev server, two visits each:

| | first story | first screen | all, scrolling | long tasks | browser memory | DOM nodes |
|---|---|---|---|---|---|---|
| Forgebook, before | 524–782 ms | 772–1,064 ms | 3.7 s | 0 ms | 510 / 737–771 MB | 6,530–6,762 |
| Forgebook, after | 570–1,425 ms | 747–1,575 ms | 3.6 s | 0–136 ms | 514 / 702–763 MB | 5,077–5,746 |
| Storybook | 1,526–1,820 ms | 1,709–1,820 ms | at once | 414–462 ms | not read / 582–630 MB | 3,505–3,508 |

"After" is the change that ships with this note: an example's code is written into the page when it is first shown, and
not for every example as the page opens. On this page it takes the shell's own document from 2,125 elements to 1,694
(the closed code blocks went from 540 elements to 100), and every frame's nodes summed from about 6,800 to 5,300. The
times and the memory moved within the machine's noise.

The benchmark's server memory on the same library, three runs (`--metric memory`): Forgebook 225 MB on a story's page
and 296 MB on a component's, Storybook 594 MB and 649 MB.

## What it says

- **Time to the first screen**: Forgebook's page shows its first stories in about half of Storybook's time, in both
  modes, and its main thread has no long task; Storybook draws all 50 stories inline before the page settles, with
  0.2–0.5 s of long tasks.
- **The whole page**: Forgebook draws a story in its own frame as it comes near, two frames loading at a time
  (`useFrameQueue`), so a reader scrolling fast to the bottom waits about 4 s for the last one. Storybook has everything
  drawn at once.
- **Memory**: before scrolling, Forgebook's browser holds less than Storybook's. With all 50 frames loaded it holds more,
  about 610–630 MB against about 465 MB for the static build: each story is a document of its own, which is also what
  keeps one story's CSS out of another. Frames are kept once loaded, so a story keeps its state when scrolled back to.

## Not measured here

- The benchmark's `componentPage` metric times every story of the page drawn in a 2600 px window without scrolling. On a
  page of 50 Forgebook stories the frames below it never load, so that metric fails for Forgebook at this size; it holds
  for the default library, five stories a component.
- Unloading frames far from the window, which would lower the memory of a fully scrolled page at the cost of a story's
  state and a reload when it comes back.
- A frame whose module fails to load (a server resetting the connection) stays blank until the page is reloaded; seen
  once with a static server that dropped connections, not with the benchmark's.
