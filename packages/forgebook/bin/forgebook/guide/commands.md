# Commands

They answer in JSON with `--json`, and every answer about a story carries the links that open it for a person.

| Command | What it is for |
|---|---|
| `npx forgebook find "selectable card" --json` | Whether what you need already exists, in your own words: ask before writing a component |
| `npx forgebook search onValueChange --json` | The whole catalogue by its text: which component has a prop, where the docs say something, with the address of the exact heading or prop |
| `npx forgebook new src/Badge.tsx` | A component's first stories, from its typed props (`Badge.vue` or `badge.component.ts` writes `Badge.stories.ts`) |
| `npx forgebook stories --component badge --json` | The stories and their ids; fails when a story file is broken, which `problems` names by `file:line:column` while the other stories stay usable |
| `npx forgebook story <id> --json` | One story: the props every use must set (`requiredProps`), its args, its component's props, the components whose stories use it, its design, and its `links`: `address` in the catalogue, `frame` alone, `embed` with no chrome, for a wiki or an iframe |
| `npx forgebook pages --json` | The docs pages, with their ids and addresses; fails when a page names what is not there |
| `npx forgebook page <id> --json` | One docs page: its Markdown, its headings, the address that opens it |
| `npx forgebook check <id> --json` | The catalogue's checks on one story: accessibility, spills, overlays, a modal's focus, errors, a failed play |
| `npx forgebook plugins --json` | The plugins the catalogue lists: their tabs (`tab=<id>` in a view opens one), switches and docs fences |
| `npx forgebook tokens --category color --json` | The design tokens, of the catalogue and of the libraries it shows; `clashes` says whose value stands where two disagree |
| `npx forgebook tokens --nearest "#1c1b1b" --json` | The token to write instead of a raw value; the type comes from the value, or `--type padding` |
| `npx forgebook check-page http://localhost:3000/checkout --json` | The same checks on a real page of the application: the screen you built, not only its stories |
| `npx forgebook changed --json` | The stories your change touches, through what they import |
| `npx forgebook verify --json` | The checks on all of them, with one exit code: run it before you say a change is done |
| `npx forgebook check-code --json` | What your change adds against the design system: raw values, with the token to use, turned-off checks, deleted tests |
| `npx forgebook errors --json` | What the open frames reported while you edited: render errors, failed plays |
| `npx forgebook shot <id> --view "dark 360"` | The story as a picture, to look at it (a view as words, or `theme=dark&width=360`); a model's id in the view (`iphone-16`) frames it in that device |
| `npx forgebook shot <id> --update` then `npx forgebook diff <id> --json` | Baselines, then what changed against them: the region, the percentage, a marked picture |

Never write a raw colour or size when a token exists: ask `tokens --nearest` first, and use a match only when it says
`isClose` or `isExact`. A match that is not close means no token fits: say so, do not force one.

Run `npx forgebook <command> --help` for the options. With an MCP client, `npx forgebook mcp` offers the same as tools.
