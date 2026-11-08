---
title: How-to/Docs pages
order: 2
description: Guides and foundations in Markdown, with live stories and props tables inside.
---

# Docs pages

Guides, foundations and recipes are Markdown files with a little front matter. They are read at build time, so nothing
is compiled in the browser, and they read well on GitHub too.

## List them

```ts
// forgebook.config.ts
export default defineConfig({
  // …
  docs: ["docs/**/*.md"]
});
```

A library gives its pages with its story source instead, so every catalogue that shows the library gets them; see
[docs pages](../../packages/forgebook/README.md#docs-pages) in the reference.

## Write a page

````md
---
title: Guides/Theming
order: 2
description: How the library follows the catalogue's theme.
---

The buttons read their colours from the page's theme.

```story stories:actions-button--primary
```

## The props

```props stories:actions-button
```

See [the colours](./colours.md#brand).
````

- `title` places the page: `Guides/Theming` is the page Theming in the group Guides. Without one, the page takes its
  first `#` heading, else its file name. `order` sorts pages, lower first.
- A `story` fence draws a live story; a `props` fence draws a component's API table from its types. The id is the
  one `forgebook stories` lists.
- A link to another page is written to its file (`./colours.md#brand`), so it works in the repository too. Images are
  relative to the file.
- `:::` blocks (asides, tabs, steps, cards) are listed under [blocks](../../packages/forgebook/README.md#blocks).

## Check them

```sh
npx forgebook pages
npx forgebook page stories:guides-theming
```

`forgebook pages` and `forgebook stories` fail when a page names a story or a component that does not exist, links to
no page, points at an image that is not a file, or holds a block that cannot be read. Each problem gives its line and
column, and the rest of the page still draws.

A page's raw HTML runs in the catalogue itself, not in a story's frame: review a page as you review code.

## A home of your own

`forgebook.home.md` beside the configuration replaces the catalogue's home page; see
[a home of your own](../../packages/forgebook/README.md#a-home-of-your-own).
