# Select

Lets the user pick one value from a list: the fixture's documentation, shown on its component page.

```tsx
import { Select } from "@fixture/kit/select";

<Select options={["weekly", "monthly"]} value="weekly" />
```

## Props

| prop | type | what |
|---|---|---|
| `value` | `string` | written by hand, left out of the page |

## Accessibility

A native `select`: the browser's keys move between the options.

| key | what it does |
|---|---|
| `↑` `↓` | the previous or the next option |
