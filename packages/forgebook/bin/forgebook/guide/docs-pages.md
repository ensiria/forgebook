# Docs pages

Guides live in Markdown files, listed in the catalogue's Docs section. Read one before writing against it
(`npx forgebook page <id>`). When you write one: front matter with `title` (`Guides/Theming`), `order` and `description`, a
fence named `story <id>` for a live story and `props <component id>` for an API table, and links to other pages by their
file (`./colours.md#brand`). A page never holds a story's code: show the story. Blocks are `:::note`, `:::tip`,
`:::important`, `:::caution`, `:::danger` (or GitHub's `> [!NOTE]`), `::::tabs{syncKey="…"}` around `:::tab[Label]`,
`:::steps` around a numbered list, `::::cards` around `:::card[Title]` and `::link-card[Title]{href="…"}`; a block inside
another has fewer colons. A code fence takes `title="…"`, `{1,4-6}`, `ins={…}`, `del={…}`, `wrap`, and `diff lang="tsx"`.
After writing one, run `npx forgebook pages`: it fails with each problem's line and column.

The catalogue's home may be written too (`forgebook.home.md`): `npx forgebook page home` reads it, and its values
(`{{components}}`) and pieces (`::families`, `::libraries`, `::recent`, `::pages`) are listed in the README.
