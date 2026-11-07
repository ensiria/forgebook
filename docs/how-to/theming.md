---
title: How-to/Theming and tokens
order: 3
description: Give the catalogue your colours, fonts and logo, and tell it your design tokens.
---

# Theming and tokens

## The shell's look

The catalogue's page can take your library's colours, fonts and corners. The theme is written into the page at build,
so nothing runs in the browser for it, and the story frames are left alone.

```ts
// forgebook.config.ts
export default defineConfig({
  // …
  shell: {
    theme: {
      light: { accent: "#7036c4", "accent-text": "#5a2aa0" },
      dark: { accent: "#b28bff" },
      fonts: { sans: "Inter, sans-serif" },
      radius: { control: "4px", card: "8px" }
    }
  }
});
```

- Every role is optional and typed by `ShellTheme` (`import type { ShellTheme } from "forgebook/shell-theme"`).
- When the catalogue starts it names a role that does not exist, a hex text colour under 4.5:1 on its ground, and an
  accent under 3:1.
- Fonts are yours to load: put the `@font-face` rules in a style sheet and name it in `shell.css`
  (`shell: { css: "shell.css" }`, by path from the configuration's folder). It loads after the shell's own sheet.
- `appearance` sets the default: `"light"`, `"dark"`, `"system"` (the default) or `"story"`, which follows the
  story's theme switch. A reader's own choice in the Interface menu wins.

With tokens (below), roles can come from them:

```ts
shell: { theme: { fromTokens: { accent: "color.brand.primary", surface: "color.background.card" } } }
```

## Your name and logo

```ts
title: "Acme UI",
logo: "acme.svg",
shell: { branding: false }
```

`branding: false` removes Forgebook's mark: the sidebar shows your logo and title, and the page icon is your logo.

## Design tokens

With no setup, `forgebook check-code` and `verify` compare hand-written values with what the application already
declares: custom properties at the root and in theme selectors, Tailwind 4's `@theme`, a Tailwind configuration, and
what `components.json` names. To name the system yourself, list your DTCG files, the base first and each theme in a
file of its own:

```ts
tokens: ["tokens.json", { file: "dark.tokens.json", mode: "dark" }]
```

Then:

```sh
npx forgebook tokens --category color
npx forgebook tokens --nearest "#1c1b1b"
```

`tokens: []` says the application's own files are not to be read; with no tokens from anywhere, colours and sizes are
then not checked, and `verify` says so (`colours and sizes not checked: no tokens file`).

A prop's TSDoc can ask for a token control (`@token color`), and so can a story's `argTypes`
(`{ control: { type: "token", of: "space" } }`).

## Switches

Theme, contrast, motion, direction and language are switches in the toolbar; a library adds its own (density, brand)
through a preset. See [several visual themes](../../packages/forgebook/README.md#several-visual-themes) and
`forgebook guide switches`.
