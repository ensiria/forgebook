# docs-references

The user documentation in `docs/` quotes the messages the commands print and names commands and options to copy. Both
drift when the code moves on: a reworded error leaves a troubleshooting entry nobody can find, a renamed option leaves
a command that fails when pasted. This test holds the pages to the code, so a change that breaks one fails `pnpm test`,
and so the CI:

- every line of a `text` fence in `docs/troubleshooting.md` must still be printed by a package's code (`src/` and
  `bin/` of `packages/*`, tests left out). A part in angle brackets (`<file>`) stands for a value; the rest must be a
  piece of a string of the source, or a whole text one of its templates prints, its values words with no space unless
  the template's fixed text is long enough to tell it apart on its own;
- every `forgebook <command>` in a page's inline code or in its shell and workflow fences must be a command of the
  `forgebook` CLI, and each `--option` after it one that command takes, read from the CLI's own description
  (`CLI_KIT_DESCRIBE=1`).

A message the source builds from several texts (a file's verdict line in `verify`) is quoted as its shape with
placeholders, and each part on a line of its own.

- `docsReferences.ts`: the reading of pages and sources, pure.
- `docsReferences.test.ts`: the checks on the real files, then each reading on small texts.
