# Switches, galleries and themes

`forgebook switches --json` (`list_switches`) lists what a catalogue offers: each switch's id, its `control` and its
values, each with the `view` to write (`--view look=night`), what it `implies`, its `sheet` and its `preview`.

A catalogue declares them in `forgebook.config.ts`:

```ts
switches: [
  { id: "theme", label: "Appearance", role: "colorScheme", default: "light",
    apply: { kind: "attribute", name: "data-theme" },
    values: [{ value: "light", label: "Light", scheme: "light" }, { value: "dark", label: "Dark", scheme: "dark" }] },
  { id: "look", label: "Theme", control: "gallery", default: "plain",
    apply: { kind: "attribute", name: "data-look" },
    values: [
      { value: "plain", label: "Plain", isUnset: true },
      { value: "paper", label: "Paper", preview: { image: "previews/paper.png" }, sheet: "looks/paper.css" },
      { value: "night", label: "Night", preview: { swatches: ["#0b1020", "#7c8cff"], font: "Harbor Sans" },
        implies: { theme: "dark" }, sheet: "looks/night.css" }
    ] }
]
```

- **`control: "gallery"`** is a menu whose items show each value's `preview`. Its code and pictures load only when it
  first opens. A value with no preview shows its label's first letter. The control's name comes from the switch and each
  item's from the value's `label`, never from the picture.
- **`preview`** is `{ image }`, a file by its path, or `{ swatches, font }`, 1 to 8 plain colours and a font's name.
  A font is only a name: drawn in it where the reader has it installed, never fetched. An address is refused, in `image`
  and in `sheet`, as are `url()` in a colour and a preview on a switch that is no gallery: the configuration's check
  stops every command with the value's name.
- **`implies`** sets other switches while the value is drawn. The implied switch's control is off and says what sets it;
  its key does nothing. The address keeps the reader's own value, which returns when the value is left, so
  `look=night&theme=light` draws dark. It wins over the address and over a story's `globals`. Between two values that imply
  different values of one switch, the switch declared first wins. An implied value may imply nothing further. Compare
  leaves out a cell it contradicts: `look,theme` shows Night only at dark, and Compare cannot pick a switch implied now.
- **`sheet`** is a style sheet of that value alone, in dev and in a build, loaded with Styles › Full only, after the source's
  sheets, the switches' in the order declared. Its path may not be an address; its contents are the author's own CSS. On a change the old sheet stays until the new one has loaded, and the root's
  attributes move with it, so no frame is drawn with neither.
- **A source's page colour** can follow a switch, so a story's box waits on the right colour:
  `background: { light, dark, bySwitch: { look: { night: { dark: "#0b1020" } } } }`. The first declared switch whose
  value gives the scheme's colour wins; otherwise `light` and `dark`.
- The reader's own **Interface** menu, at the sidebar's foot, colours the catalogue around the stories and never the
  stories themselves. `strings: { appearance: "…" }` renames it; the `appearance` setting keeps its name.
