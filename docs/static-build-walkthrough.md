# A static build, read by someone who does not develop

A catalogue is also read by designers, product owners and testers who never run it. This note walks through what such a
reader meets in a static build, and what was confusing.

## How it was looked at

The fixture kit (13 components, 29 stories, 5 docs pages, a written home) was built as a library team would publish
it, `forgebook build`, and served by a plain static server on one origin. Playwright took screenshots of the home, a
docs page, a component's page, a story and a search, in light and dark at 1440 px and in light at 360 px, and each
screenshot was read. The build took 3.2 s and weighs 1.4 MB.

## What a reader sees

- **Home.** The catalogue's name, a one-line count, the authors' text, a "Start here" note, link cards, a live story and
  the guides. Clear at both widths; "Recently opened" appears after a first visit.
- **Docs page.** A breadcrumb, the title, the text with its live stories, and "On this page" at the side. Readable. Above
  it sits the stories' toolbar (theme, contrast, widths, device frame, Panel and Compare greyed out): it changes the
  page's live stories, but a reader is not told so, and the greyed buttons say nothing about why.
- **Component page.** The description, a live example, the import line, an accessibility section, the props table.
  Good for a reader. The breadcrumb's "also listed in Forms › Fields" and the "Related: Page" line are the
  catalogue's words, not a reader's.
- **A story.** The toolbar, the story in a resizable box, zoom and measure tools, and a panel of props, events, parts,
  code and accessibility. This is the developer's view, dense for a reader, which is expected.
- **Search.** `/` opens it; "dialog" finds `Select` through a story's text ("With popup"), as the audit says. At the same
  time the sidebar under the field says "No name matches", which reads as a contradiction next to a result.

## What was confusing, and what was done

| Finding | Done |
|---|---|
| A family holding only aliases (Forms) showed **0** beside an expandable entry, which reads as empty | Fixed: no count where a family or group holds none of its own; aliases are still not counted |
| A page whose code cannot be fetched showed "The page could not be loaded: Unable to preload CSS for …/assets/….css" and nothing to do. It happened once here under load; on a real host it happens to every reader whose tab stayed open across a new deployment | Fixed: the message has a "Reload the page" button |
| The README's home example writes `{{libraries}} libraries`, which a catalogue of one library shows as "in 1 libraries" (seen here) | Fixed: the example no longer counts libraries |
| The sidebar says "No name matches" while the search lists a result found by text | Not changed: it is true (no name matches), and changing the sidebar's filter is not a small thing |
| On a docs page, the stories' toolbar and the greyed Panel and Compare are unexplained | Not changed: noted for the shell's reader mode |
| At 360 px the header has only the sidebar button: search is one tap further, and `/` does nothing visible | Not changed: a search button in the narrow header costs first-load bytes; noted |
| In dark appearance the stories stay light: the shell's appearance and the stories' theme are separate on purpose, which the kit's Theming page explains but a reader may not read | Not changed |

## Numbers

- First-load JavaScript referenced by `index.html`, gzipped: 122 049 B before, 122 092 B after the fixes (+43 B).
- Screenshots: 33 across three passes (home, docs, component, story, search; light and dark at 1440 px, light at 360 px).
