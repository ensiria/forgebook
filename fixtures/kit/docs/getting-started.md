---
title: Getting started
order: 1
description: Install the kit, then pick a `Select` for the first form.
---

# Getting started

The kit draws a form's choices. This page shows three of them live: change the theme in the toolbar and each follows.

## Install

```sh
pnpm add @fixture/kit
```

Then import what the page needs:

```tsx
import { Select } from "@fixture/kit/select";

export const Period = () => <Select options={["weekly", "monthly"]} />;
```

## The default select

Most forms start here.

```story kit:inputs-selection-select--overview
```

## A smaller select

For a toolbar or a dense table, see [choosing a select](./guides/choosing-a-select.md#in-a-row).

```story kit:inputs-selection-select--small
```

## With a hint

A hint says what the choice changes.

```story kit:inputs-selection-select--hinted
```

## Next steps

- Read [Theming](./guides/theming.md).
- Jump back to [the install](#install).
- See every state on [the component's page](?component=kit:inputs-selection-select).
- The [Forgebook repository](https://github.com/ensiria/forgebook) has more.
