---
title: Guides/Theming
order: 2
description: How the kit follows the catalogue's theme and contrast.
---

The kit reads its colours from the page's theme, so a story needs no theme of its own.

![The kit's mark](../../logo.svg)

## Light and dark

> The reader picks the shell's appearance; the switches pick the stories' theme. The two are apart on purpose.

| Switch | Values |
|---|---|
| Theme | Light, Dark |
| Contrast | Normal, More |

```story kit:inputs-selection-select--overview
```

## More contrast

Contrast raises the edges and the text, never the sizes.

```css
.fixture-select {
  border-color: var(--kit-edge);
}
```

## Light and dark

The second section with the same name keeps its own anchor.
