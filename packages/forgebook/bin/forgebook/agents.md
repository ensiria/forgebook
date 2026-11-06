## Stories (Forgebook)

This project's components have stories, shown by [Forgebook](https://github.com/ensiria/forgebook) (`forgebook dev`).
A component you add or change gets its stories added or changed in the same change, whether or not a check asks for them.

### Before you say a change is done

```sh
npx forgebook verify --json       # every changed UI file in stories that ran, every variant, and check-code
npx forgebook check-code --json   # what the change adds against the design system
```

A non-zero exit (`not-verified`, `failed`) means not done, and a UI file with no stories is `not-verified`: `fix` names the
next step, usually writing them; do it and run it again. Report `partly-verified` with what `skipped` says, never as verified. To look at one story, `npx forgebook check <id> --json`
and `npx forgebook shot <id> --view "dark 360"`.

### Look it up when you need it

| Command | What it answers |
|---|---|
| `npx forgebook find "selectable card" --json` | Whether it already exists: ask before writing a component |
| `npx forgebook story <id> --json` | `requiredProps` (set every name), props, `docs.guidance` (never use a deprecated component), the `links` a person opens |
| `npx forgebook tokens --nearest "#1c1b1b" --json` | The token to write instead of a raw colour or size; only when it says `isClose` or `isExact` |
| `npx forgebook search onValueChange --json` | A prop or a sentence anywhere in the catalogue |
| `npx forgebook guide <topic>` | The full text on demand: `stories`, `devices`, `switches`, `docs-pages`, `links`, `commands`, `setup`, a framework's name, or `all`; with no topic, the list |

`npx forgebook <command> --help` gives the options. With an MCP client, `npx forgebook mcp` offers the same as tools:
`find_component`, `get_story`, `nearest_token`, `check_story`, `story_shot`, `get_guide`.

### Writing a story

One file per component, beside it, in CSF 3 (`npx forgebook new <component file>` writes the first). Every named export is a
story, with a one-line TSDoc. Add a worst case: very long text, words without spaces, huge numbers.

{{framework}}
