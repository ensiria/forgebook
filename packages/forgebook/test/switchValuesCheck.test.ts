/**
 * Tests for the configuration's check of a switch's values: a gallery's preview, what a value implies, its own sheet;
 * and for the module of previews and the frame's sheets the generated pages import.
 *
 * @module
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { valueSheetUrls } from "../src/frame/valueSheets.ts";
import { galleryPlace } from "../src/shell/galleryPlace.ts";
import { type SwitchValue, themeSwitch, type ViewSwitch } from "../src/switches.ts";
import { configModule, switchPreviewsModule } from "../src/vite/pages.ts";
import { switchValuesProblem, withAbsoluteValueFiles } from "../src/vite/switchValuesCheck.ts";

const DIR = mkdtempSync(join(tmpdir(), "forgebook-switch-values-"));
writeFileSync(join(DIR, "paper.png"), "");
writeFileSync(join(DIR, "paper.css"), "");

/** A gallery with one value besides its default. */
const gallery = (value: Partial<SwitchValue>, control: ViewSwitch["control"] = "gallery"): ViewSwitch[] => [
  themeSwitch(),
  {
    id: "look",
    label: "Theme",
    control,
    apply: { kind: "code" },
    default: "plain",
    values: [
      { value: "plain", label: "Plain" },
      { value: "paper", label: "Paper", ...value }
    ]
  }
];

const problemOf = (value: Partial<SwitchValue>, control?: ViewSwitch["control"]): string | undefined =>
  switchValuesProblem(gallery(value, control), DIR);

/** A value as the configuration might write it, whatever its type allows. */
const preview = (written: unknown): Partial<SwitchValue> => JSON.parse(JSON.stringify({ preview: written }));

describe("a gallery's preview in the configuration", () => {
  it("takes a file of the project, or colours with a font's name, or nothing", () => {
    expect(problemOf({ preview: { image: "paper.png" } })).toBeUndefined();
    expect(
      problemOf({ preview: { swatches: ["#123", "rgb(1 2 3 / 50%)", "teal"], font: "Harbor Sans" } })
    ).toBeUndefined();
    expect(problemOf({})).toBeUndefined();
  });

  it.each([
    "https://cdn.example.test/paper.png",
    "//cdn.example.test/paper.png",
    "data:image/png;base64,AAAA",
    "\\\\server\\share\\paper.png"
  ])("refuses a picture at an address: %s", (image) => {
    expect(problemOf({ preview: { image } })).toContain("nothing is loaded from an address");
  });

  it("refuses what is no picture, and a file that is not there", () => {
    expect(problemOf({ preview: { image: "paper.css" } })).toContain("must be a picture");
    expect(problemOf({ preview: { image: "gone.png" } })).toContain("names no file");
  });

  it.each(['url("https://cdn.example.test/a.png")', "red; background: url(x)", "var(--x)", "expression(1)"])(
    "refuses a swatch that is not a plain colour: %s",
    (colour) => {
      expect(problemOf({ preview: { swatches: [colour] } })).toContain("not a plain colour");
    }
  );

  it("refuses no colours, too many, and a font that is more than a name", () => {
    expect(problemOf({ preview: { swatches: [] } })).toContain("1 to 8");
    expect(problemOf({ preview: { swatches: Array.from({ length: 9 }, () => "#000") } })).toContain("1 to 8");
    expect(problemOf({ preview: { swatches: ["#000"], font: 'a"; src: url(x)' } })).toContain("not a name");
    expect(problemOf({ preview: { swatches: ["#000"], font: "https://example.test/a.woff2" } })).toContain(
      "not a name"
    );
  });

  it("refuses a key it does not know, both forms at once, and neither", () => {
    expect(problemOf(preview({ picture: "paper.png" }))).toContain('no "picture"');
    expect(problemOf(preview({ image: "paper.png", swatches: ["#000"] }))).toContain("not both");
    expect(problemOf(preview({}))).toContain("needs image, or swatches");
  });

  it("refuses a preview on a switch that is no gallery, where it would show nowhere", () => {
    expect(problemOf({ preview: { image: "paper.png" } }, "list")).toContain('add control: "gallery"');
  });
});

describe("what a value implies, in the configuration", () => {
  it("takes another switch's value", () => {
    expect(problemOf({ implies: { theme: "dark" } })).toBeUndefined();
  });

  it("leaves the language to the page, where a source may offer more", () => {
    expect(problemOf({ implies: { lang: "it" } })).toBeUndefined();
  });

  it("refuses the system's value, which Compare has no cell for", () => {
    expect(problemOf({ implies: { theme: "system" } })).toContain("only follows the system");
  });

  it("refuses a switch or a value there is not, and its own switch", () => {
    expect(problemOf({ implies: { nope: "dark" } })).toContain("a switch there is not");
    expect(problemOf({ implies: { theme: "dusk" } })).toContain("does not have");
    expect(problemOf({ implies: { look: "plain" } })).toContain("its own switch");
  });

  it("refuses an implied value that implies more: a view has one answer", () => {
    const [theme, look] = gallery({ implies: { theme: "dark" } });
    if (theme === undefined || look === undefined) throw new Error("no switches");
    const chain: ViewSwitch = {
      ...theme,
      values: theme.values.map((value) =>
        value.value === "dark" ? { ...value, implies: { other: "on" } } : value
      )
    };
    const other: ViewSwitch = { ...look, id: "other", values: [{ value: "on", label: "On" }], default: "on" };
    expect(switchValuesProblem([chain, look, other], DIR)).toContain("implies nothing further");
  });
});

describe("a value's own sheet, in the configuration", () => {
  it("takes a style sheet of the project", () => {
    expect(problemOf({ sheet: "paper.css" })).toBeUndefined();
  });

  it("refuses an address, what is no style sheet, and a file that is not there", () => {
    expect(problemOf({ sheet: "https://cdn.example.test/a.css" })).toContain("from an address");
    expect(problemOf({ sheet: "paper.png" })).toContain("must be a style sheet");
    expect(problemOf({ sheet: "gone.css" })).toContain("names no file");
  });
});

describe("the sheets a view draws with", () => {
  const Sheets = { "look=paper": "/paper.css", "grain=coarse": "/coarse.css", "theme=dark": "/dark.css" };
  const Look = gallery({ implies: { theme: "dark" } })[1];
  if (Look === undefined) throw new Error("no look");
  const Grain: ViewSwitch = {
    id: "grain",
    label: "Grain",
    apply: { kind: "code" },
    default: "fine",
    values: [
      { value: "fine", label: "Fine" },
      { value: "coarse", label: "Coarse" }
    ]
  };

  it("lists them in the switches' order, an implied value's among them", () => {
    expect(
      valueSheetUrls({ look: "paper", grain: "coarse" }, "full", Sheets, [themeSwitch(), Look, Grain])
    ).toEqual(["/dark.css", "/paper.css", "/coarse.css"]);
  });

  it("has none for a value without a sheet", () => {
    expect(valueSheetUrls({ look: "plain" }, "full", Sheets, [Look])).toEqual([]);
  });

  it("is Styles › Full's alone, as the source's theme is", () => {
    expect(valueSheetUrls({ look: "paper" }, "structure", Sheets, [Look])).toEqual([]);
    expect(valueSheetUrls({ look: "paper" }, "restyled", Sheets, [Look])).toEqual([]);
  });
});

describe("what the pages import of a value", () => {
  const Switches = withAbsoluteValueFiles(
    gallery({ preview: { image: "paper.png" }, sheet: "paper.css" }).concat({
      id: "fonts",
      label: "Fonts",
      control: "gallery",
      apply: { kind: "code" },
      default: "a",
      values: [{ value: "a", label: "A", preview: { swatches: ["#000"], font: "Harbor Sans" } }]
    }),
    DIR
  );

  it("imports a picture for its address, never inlined into the module", () => {
    const code = switchPreviewsModule({ switches: Switches });
    expect(code).toContain("paper.png?url&no-inline");
    expect(code).toContain("look");
    expect(code).toContain("Harbor Sans");
  });

  it("leaves previews and sheets out of the configuration's data, which every first load carries", () => {
    const code = configModule(
      {
        title: "T",
        heights: undefined,
        switches: Switches,
        stories: [],
        languages: [],
        lists: {}
      },
      { kind: "same-origin" },
      false
    );
    expect(code).not.toContain("paper.png");
    expect(code).not.toContain("paper.css");
    expect(code).not.toContain("Harbor Sans");
  });
});

describe("where a gallery's menu sits", () => {
  const Room = { width: 800, height: 600 };
  const Button = { top: 100, bottom: 120, left: 50 };

  it("sits under its button", () => {
    expect(galleryPlace(Button, { width: 300, height: 200 }, Room)).toEqual({ top: 126, left: 50 });
  });

  it("stays inside the window on the right", () => {
    expect(galleryPlace({ ...Button, left: 700 }, { width: 300, height: 200 }, Room).left).toBe(494);
  });

  it("goes over its button when only there it fits", () => {
    expect(galleryPlace({ top: 500, bottom: 520, left: 0 }, { width: 300, height: 200 }, Room).top).toBe(294);
  });

  it("starts at the window's top when taller than the room", () => {
    expect(galleryPlace(Button, { width: 300, height: 900 }, Room).top).toBe(6);
  });
});
