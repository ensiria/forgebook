# check-markdown-blocks

A fence nobody closed turns the rest of a page into code, or its prose into a sample, and GitHub and npm render the
mistake without a word. Merges have done it: a section that disappears into the example above it, a workflow that
cannot be copied. This command reads every Markdown file git tracks and fails with the file and line of:

- a fence that is never closed;
- a fence that opens with a language inside a block of the same length, which CommonMark takes for text and which is
  how a lost closing fence looks. A sample that shows fences has a longer fence around it, and its own are read too;
- a `yaml` or `json` sample that does not parse;
- a link to a heading of the page (`](#search)`) that finds no heading outside a block.

It reads what these repositories write, not all of CommonMark: a fence inside a block quote, a setext heading, an
`<a id>` target and a reference link (`[r]: #x`) are not followed. A link to one of the last three fails; write an ATX
heading instead.

`pnpm blocks:check` runs it, inside `pnpm checks`, so the CI does too.

- `markdownBlocks.ts`: the reading and the rules, pure.
- `markdownBlocks.test.ts`: each rule on small texts, the tree's Markdown kept valid by the command itself.
