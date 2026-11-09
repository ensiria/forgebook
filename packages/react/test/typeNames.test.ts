/**
 * Tests for the names a prop's type goes by, as a custom control's `matches` reads them: through aliases, an import's
 * new name, `undefined` and `null`, and unions whose members all go by one name.
 *
 * @module
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { PropDocs } from "forgebook/component-docs";
import { afterAll, describe, expect, it } from "vitest";

import { extractComponentDocs } from "../src/vite/extractDocs.ts";

/** The folders written, removed after the tests: inside the package, so React's types resolve as a project's would. */
const written: string[] = [];
afterAll(() => {
  for (const dir of written) rmSync(dir, { recursive: true, force: true });
});

/**
 * The props of a component written in a fresh folder beside an icons module, read through a story file naming it.
 *
 * @param source - the component's file, named `Button.tsx`.
 * @param others - other files beside it, by name.
 */
const propsOf = (
  source: string,
  others: Readonly<Record<string, string>> = {}
): Readonly<Record<string, PropDocs>> => {
  const dir = mkdtempSync(join(import.meta.dirname, ".type-names-"));
  written.push(dir);
  writeFileSync(
    join(dir, "icons.ts"),
    [
      'import type { ComponentType } from "react";',
      "/** An icon's props. */",
      "export type IconProps = { readonly size?: number };",
      "/** An icon: a component drawing one. */",
      "export type IconComponent = ComponentType<IconProps>;",
      "/** The icon at a button's start. */",
      "export type ButtonIcon = IconComponent;",
      "/** An icon, or none. */",
      "export type MaybeIcon = IconComponent | undefined | null;",
      ""
    ].join("\n")
  );
  writeFileSync(join(dir, "Button.tsx"), source);
  for (const [name, text] of Object.entries(others)) writeFileSync(join(dir, name), text);
  writeFileSync(
    join(dir, "Button.stories.tsx"),
    'import { Button } from "./Button";\nexport default { component: Button };\nexport const Shown = {};\n'
  );
  const docs = extractComponentDocs(join(dir, "Button.stories.tsx"));
  if (typeof docs === "string" || docs.name === null) throw new Error(String(docs));
  return Object.fromEntries(docs.props.map((prop) => [prop.name, prop]));
};

describe("a prop's type names in props written as alternatives, and a default export", () => {
  const props = propsOf(
    [
      'import type { ReactNode } from "react";',
      'import type { ButtonIcon } from "./icons";',
      'import type Shape from "./shape";',
      "/** A button's props: an icon in one branch only. */",
      "export type ButtonProps =",
      '  | { readonly kind: "text"; readonly startIcon?: never; readonly shape?: Shape }',
      '  | { readonly kind: "icon"; readonly startIcon: ButtonIcon; readonly shape?: Shape };',
      "/** A button. */",
      "export const Button = (props: ButtonProps): ReactNode => null;",
      ""
    ].join("\n"),
    { "shape.ts": "/** A shape. */\nexport default interface Shape { readonly round: boolean }\n" }
  );

  it("reads the names of the branch that takes a value", () => {
    expect(props["startIcon"]?.typeNames).toEqual(["ButtonIcon", "IconComponent"]);
  });

  it("names a default export by the name it was declared with", () => {
    expect(props["shape"]?.typeNames).toBeUndefined();
    expect(props["shape"]?.type).toBe("Shape");
  });
});

describe("a prop's type names", () => {
  const props = propsOf(
    [
      'import type { ComponentType, ReactNode } from "react";',
      'import type { ButtonIcon, IconComponent, IconComponent as Glyph, MaybeIcon } from "./icons";',
      'import type * as Icons from "./icons";',
      "/** A button's props. */",
      "export type ButtonProps<TIcon> = {",
      "  /** Plain. */",
      "  readonly icon: IconComponent;",
      "  /** Optional, with undefined written too. */",
      "  readonly endIcon?: IconComponent | undefined;",
      "  /** Through an alias. */",
      "  readonly startIcon?: ButtonIcon;",
      "  /** Through an alias that holds undefined and null. */",
      "  readonly maybeIcon?: MaybeIcon;",
      "  /** Renamed by its import. */",
      "  readonly glyph?: Glyph;",
      "  /** Named through its module. */",
      "  readonly qualified?: Icons.IconComponent;",
      "  /** A union whose members all are one. */",
      "  readonly either?: IconComponent | ButtonIcon;",
      "  /** A union that is something else too. */",
      "  readonly iconOrNode?: IconComponent | ReactNode;",
      "  /** A generic's reference. */",
      "  readonly component?: ComponentType<{ readonly size?: number }>;",
      "  /** A type parameter. */",
      "  readonly custom?: TIcon;",
      "  /** Plain text. */",
      "  readonly label?: string;",
      "};",
      "/** A button. */",
      "export const Button = <TIcon,>(props: ButtonProps<TIcon>): ReactNode => null;",
      ""
    ].join("\n")
  );

  it("says nothing more than the type when the type is the one name, written with or without undefined", () => {
    expect(props["icon"]).toMatchObject({ type: "IconComponent" });
    expect(props["icon"]?.typeNames).toBeUndefined();
    expect(props["endIcon"]).toMatchObject({ type: "IconComponent" });
    expect(props["endIcon"]?.typeNames).toBeUndefined();
  });

  it("follows aliases, through undefined and null", () => {
    expect(props["startIcon"]?.typeNames).toEqual(["ButtonIcon", "IconComponent"]);
    expect(props["maybeIcon"]?.typeNames).toEqual(["MaybeIcon", "IconComponent"]);
  });

  it("names the type an import renamed and one named through its module", () => {
    expect(props["glyph"]?.typeNames).toEqual(["Glyph", "IconComponent"]);
    expect(props["qualified"]?.typeNames).toEqual(["Icons.IconComponent", "IconComponent"]);
  });

  it("keeps a union's names only when every member goes by them", () => {
    expect(props["either"]?.typeNames).toEqual(["IconComponent"]);
    expect(props["iconOrNode"]?.typeNames).toBeUndefined();
  });

  it("names no generic's reference, type parameter or keyword", () => {
    expect(props["component"]?.typeNames).toBeUndefined();
    expect(props["custom"]?.typeNames).toBeUndefined();
    expect(props["label"]?.typeNames).toBeUndefined();
  });
});
