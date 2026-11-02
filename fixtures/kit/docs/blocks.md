---
title: Blocks
order: 5
description: Every block a page can write, on one page, so a reader sees each and a test reaches each.
---

## Asides

:::note
A note says something worth knowing on the way.
:::

:::tip[A tip with its own title]
A tip helps. An aside holds any Markdown, and a story too:

```story kit:inputs-selection-select--small
```
:::

:::important
An important remark.
:::

:::caution
A caution warns before something goes wrong.
:::

:::danger
A danger says what breaks.
:::

## Alerts

> [!NOTE]
> GitHub's alerts read the same, so the page stays readable in the repository.

> [!TIP]
> A tip, as GitHub writes it.

> [!IMPORTANT]
> Something important.

> [!WARNING]
> A warning is a caution here.

> [!CAUTION]
> A caution is a danger here.

## Tabs

::::tabs{syncKey="package-manager"}
:::tab[pnpm]
```sh
pnpm add @fixture/kit
```
:::
:::tab[npm]
```sh
npm install @fixture/kit
```
:::
::::

The same choice, kept by a second set of tabs:

::::tabs{syncKey="package-manager"}
:::tab[pnpm]
pnpm keeps one store for every project.
:::
:::tab[npm]
npm installs in each project.
:::
::::

## Steps

:::steps
1. Install the kit.

   ```sh
   pnpm add @fixture/kit
   ```

2. Import the select.

   ```tsx
   import { Select } from "@fixture/kit/select";
   ```

3. Draw it.

   ```story kit:inputs-selection-select--hinted
   ```
:::

## Cards

::::cards
:::card[Light and dark]
Every story follows the theme switch.
:::
:::card[More contrast]
Edges and text rise; sizes stay.
:::
::link-card[Theming]{href="./guides/theming.md#more-contrast" description="The guide behind both cards."}
::::

## Code

```tsx title="Period.tsx" {3} ins={4} del={5}
import { Select } from "@fixture/kit/select";

export const Period = () => (
  <Select options={["weekly", "monthly"]} />
  <Select options={["weekly"]} />
);
```

```diff lang="tsx"
 import { Select } from "@fixture/kit/select";
-const size = "md";
+const size = "sm";
```

```md wrap
A long line that wraps instead of scrolling sideways, so a reader on a narrow screen reads it whole without reaching for the scroll bar.
```
