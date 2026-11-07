/**
 * Tests for props read from types the checker cannot list plainly: a discriminated union's variant props, a generic
 * component's type parameters, and a component whose props cannot be read at all.
 *
 * @module
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ComponentDocs } from "forgebook/component-docs";
import { afterAll, describe, expect, it } from "vitest";

import { extractComponentDocs } from "../src/vite/extractDocs.ts";

/** The folders written, removed after the tests: inside the package, so React's types resolve as a project's would. */
const written: string[] = [];
afterAll(() => {
  for (const dir of written) rmSync(dir, { recursive: true, force: true });
});

/**
 * The docs of a component written in a fresh folder, read through a story file naming it.
 *
 * @param name - the component's name.
 * @param source - the component's file.
 */
const docsOf = (name: string, source: string): ComponentDocs => {
  const dir = mkdtempSync(join(import.meta.dirname, ".props-types-"));
  written.push(dir);
  writeFileSync(join(dir, `${name}.tsx`), source);
  writeFileSync(
    join(dir, `${name}.stories.tsx`),
    `import { ${name} } from "./${name}";\nexport default { component: ${name} };\nexport const Shown = {};\n`
  );
  const docs = extractComponentDocs(join(dir, `${name}.stories.tsx`));
  if (typeof docs === "string" || docs.name === null) throw new Error(String(docs));
  return docs;
};

describe("a discriminated union's props", () => {
  const docs = docsOf(
    "Action",
    [
      'import type { ReactNode } from "react";',
      "/** An action's props. */",
      "export type ActionProps = (",
      '  | { readonly kind: "link";',
      "      /** Where it goes. */",
      "      readonly href: string }",
      '  | { readonly kind: "button";',
      "      /** Runs it. */",
      "      readonly onClick: () => void }",
      ") & {",
      "  /** Its title. */",
      "  readonly title: string;",
      "};",
      "/** A link or a button. */",
      "export const Action = (props: ActionProps): ReactNode => null;",
      ""
    ].join("\n")
  );
  const byName = Object.fromEntries(docs.props.map((prop) => [prop.name, prop]));

  it("lists every variant's props, each with the variant it belongs to, and none as required", () => {
    expect(docs.props.map((prop) => prop.name)).toEqual(["kind", "href", "onClick", "title"]);
    expect(byName["href"]).toMatchObject({ isRequired: false, onlyWhen: { prop: "kind", values: ["link"] } });
    expect(byName["href"]?.description).toBe("Where it goes.");
    expect(byName["onClick"]).toMatchObject({
      kind: "event",
      onlyWhen: { prop: "kind", values: ["button"] }
    });
    expect(byName["title"]).toMatchObject({ isRequired: true });
    expect(byName["title"]?.onlyWhen).toBeUndefined();
  });

  it("keeps the discriminant a choice of its variants' values, required", () => {
    expect(byName["kind"]).toMatchObject({ kind: "choice", choices: ["link", "button"], isRequired: true });
  });
});

describe("a union whose variants type one prop each their way, and one leaves the discriminant out", () => {
  const docs = docsOf(
    "Picker",
    [
      'import type { ReactNode } from "react";',
      "type Base = { readonly label: string };",
      "export type PickerProps = Base & (",
      '  | { readonly mode: "single"; readonly required?: boolean; readonly selected?: Date }',
      '  | { readonly mode: "multiple"; readonly required?: boolean; readonly selected?: Date[]; readonly max?: number }',
      '  | { readonly mode: "range"; readonly required?: boolean; readonly selected?: [Date, Date]; readonly max?: number }',
      "  | { readonly mode?: undefined; readonly required?: undefined; readonly loose?: boolean }",
      ");",
      "export const Picker = (props: PickerProps): ReactNode => null;",
      ""
    ].join("\n")
  );
  const byName = Object.fromEntries(docs.props.map((prop) => [prop.name, prop]));

  it("takes the prop with the most values as the discriminant, and leaves out the variant without one", () => {
    expect(byName["max"]?.onlyWhen).toEqual({ prop: "mode", values: ["multiple", "range"] });
    expect(byName["selected"]?.onlyWhen).toEqual({ prop: "mode", values: ["single", "multiple", "range"] });
  });

  it("writes every variant's type for a prop they type differently, with nothing only one of them says", () => {
    expect(byName["selected"]).toMatchObject({ kind: "other", type: "Date | Date[] | [Date, Date]" });
    expect(byName["selected"]?.shape).toBeUndefined();
  });

  it("says a prop of the variant without a discriminant applies when it is left out", () => {
    expect(byName["loose"]).toMatchObject({ kind: "toggle", isRequired: false });
    expect(byName["loose"]?.onlyWhen).toEqual({ prop: "mode", values: [], orOmitted: true });
  });
});

describe("a union with no discriminant", () => {
  it("lists a prop only some members have as optional, with no condition", () => {
    const docs = docsOf(
      "Media",
      [
        'import type { ReactNode } from "react";',
        "export type MediaProps = { readonly src: string; readonly alt: string } | { readonly children: ReactNode };",
        "export const Media = (props: MediaProps): ReactNode => null;",
        ""
      ].join("\n")
    );
    const byName = Object.fromEntries(docs.props.map((prop) => [prop.name, prop]));
    expect(Object.keys(byName)).toEqual(["src", "alt", "children"]);
    expect(byName["src"]).toMatchObject({ isRequired: false });
    expect(byName["src"]?.onlyWhen).toBeUndefined();
  });
});

describe("a generic component's props", () => {
  const docs = docsOf(
    "List",
    [
      'import type { ReactNode } from "react";',
      "export type ListProps<TItem, TKey extends string = string> = {",
      "  readonly items: readonly TItem[];",
      "  readonly selected?: TKey;",
      '  readonly mode?: "single" | "many";',
      "};",
      "export const List = <TItem, TKey extends string = string>(props: ListProps<TItem, TKey>): ReactNode => null;",
      ""
    ].join("\n")
  );
  const byName = Object.fromEntries(docs.props.map((prop) => [prop.name, prop]));

  it("writes a type parameter as its constraint, and says so", () => {
    expect(byName["selected"]).toMatchObject({ kind: "text", type: "string" });
    expect(byName["selected"]?.notes).toEqual([
      { reason: "generic", parameter: "TKey", shownAs: "constraint", type: "string" }
    ]);
  });

  it("writes an unconstrained one as unknown, and says so", () => {
    expect(byName["items"]?.type).toBe("readonly unknown[]");
    expect(byName["items"]?.notes).toEqual([
      { reason: "generic", parameter: "TItem", shownAs: "unknown", type: "unknown" }
    ]);
  });

  it("replaces a type parameter its constraint or default names, once", () => {
    const named = docsOf(
      "Field",
      [
        'import type { ReactNode } from "react";',
        "type Values = Record<string, unknown>;",
        "export type FieldProps<TValues extends Values, TName extends keyof TValues = keyof TValues> = {",
        "  readonly name: TName;",
        "  readonly values?: TValues;",
        "  readonly self?: TSelf;",
        "};",
        "type TSelf = string;",
        "export const Field = <TValues extends Values, TName extends keyof TValues = keyof TValues>(",
        "  props: FieldProps<TValues, TName>",
        "): ReactNode => null;",
        ""
      ].join("\n")
    );
    const field = Object.fromEntries(named.props.map((prop) => [prop.name, prop]));
    expect(field["name"]?.type).toBe("keyof Values");
    expect(field["name"]?.notes).toEqual([
      { reason: "generic", parameter: "TName", shownAs: "constraint", type: "keyof Values" }
    ]);
    expect(field["self"]?.notes).toBeUndefined();
  });

  it("reads a props type the component instantiates as it is, with no note", () => {
    const fixed = docsOf(
      "Choice",
      [
        'import type { ReactNode } from "react";',
        "type BaseProps<TValue> = { readonly value: TValue; readonly options: readonly TValue[] };",
        "export type ChoiceProps = BaseProps<string>;",
        "export const Choice = (props: ChoiceProps): ReactNode => null;",
        ""
      ].join("\n")
    );
    const choice = Object.fromEntries(fixed.props.map((prop) => [prop.name, prop]));
    expect(choice["value"]).toMatchObject({ kind: "text", type: "string" });
    expect(choice["options"]?.type).toBe("readonly string[]");
    expect(choice["value"]?.notes).toBeUndefined();
    expect(choice["options"]?.notes).toBeUndefined();
  });

  it("leaves a plain prop without a note", () => {
    expect(byName["mode"]).toMatchObject({ kind: "choice", choices: ["single", "many"] });
    expect(byName["mode"]?.notes).toBeUndefined();
  });
});

describe("props that cannot be read", () => {
  it("says why when a prop's type names something the checker cannot find, or is any", () => {
    const docs = docsOf(
      "Odd",
      [
        'import type { ReactNode } from "react";',
        "export type OddProps = {",
        "  // @ts-expect-error a type that is not there",
        "  readonly value: Missing;",
        "  // biome-ignore lint: any, as some libraries write it",
        "  readonly loose: any;",
        "};",
        "export const Odd = (props: OddProps): ReactNode => null;",
        ""
      ].join("\n")
    );
    const byName = Object.fromEntries(docs.props.map((prop) => [prop.name, prop]));
    expect(byName["value"]?.notes).toEqual([{ reason: "unresolved", name: "Missing" }]);
    expect(byName["loose"]?.notes).toEqual([{ reason: "any" }]);
  });

  it("says why a component lists no props: untyped, or all from outside the package", () => {
    const untyped = docsOf(
      "Loose",
      'import type { ReactNode } from "react";\n// biome-ignore lint: any\nexport const Loose = (props: any): ReactNode => null;\n'
    );
    expect(untyped.props).toEqual([]);
    expect(untyped.propsNote).toEqual({ reason: "untyped" });
    const foreign = docsOf(
      "Plain",
      'import type { ComponentProps, ReactNode } from "react";\nexport const Plain = (props: ComponentProps<"button">): ReactNode => null;\n'
    );
    expect(foreign.props).toEqual([]);
    expect(foreign.propsNote).toMatchObject({ reason: "outside-package" });
  });

  it("adds no note to a component whose props are read", () => {
    const docs = docsOf(
      "Tag",
      'import type { ReactNode } from "react";\nexport const Tag = (props: { readonly label: string }): ReactNode => null;\n'
    );
    expect(docs.propsNote).toBeUndefined();
    expect(docs.props[0]?.notes).toBeUndefined();
  });
});

describe("what a review found", () => {
  it("shows a type parameter as the component's constraint, not the props type's", () => {
    const docs = docsOf(
      "Pick",
      [
        "type P<T> = { readonly value: T; readonly items: readonly T[] };",
        "export const Pick = <T extends string>(props: P<T>) => null;",
        ""
      ].join("\n")
    );
    const byName = Object.fromEntries(docs.props.map((prop) => [prop.name, prop]));
    expect(byName["value"]).toMatchObject({ kind: "text", type: "string" });
    expect(byName["items"]?.type).toBe("readonly string[]");
    expect(byName["items"]?.notes).toEqual([
      { reason: "generic", parameter: "T", shownAs: "constraint", type: "string" }
    ]);
  });

  it("keeps the signature of an event two variants type alike", () => {
    const docs = docsOf(
      "Press",
      [
        "export type PressProps =",
        '  | { readonly kind: "a"; readonly onPress: () => void }',
        '  | { readonly kind: "b"; readonly onPress: () => void }',
        '  | { readonly kind: "c" };',
        "export const Press = (props: PressProps) => null;",
        ""
      ].join("\n")
    );
    const onPress = docs.props.find((prop) => prop.name === "onPress");
    expect(onPress).toMatchObject({ kind: "event", signature: { parameters: [], returns: "void" } });
    expect(onPress?.onlyWhen).toEqual({ prop: "kind", values: ["a", "b"] });
  });

  it("says a prop also applies when an optional discriminant is left out", () => {
    const docs = docsOf(
      "Range",
      [
        "export type RangeProps =",
        '  | { readonly mode?: "single"; readonly onPick?: () => void }',
        '  | { readonly mode: "range"; readonly onRange: () => void }',
        "  | { readonly mode?: undefined; readonly bare?: boolean };",
        "export const Range = (props: RangeProps) => null;",
        ""
      ].join("\n")
    );
    const byName = Object.fromEntries(docs.props.map((prop) => [prop.name, prop]));
    expect(byName["onPick"]?.onlyWhen).toEqual({ prop: "mode", values: ["single"], orOmitted: true });
    expect(byName["onRange"]?.onlyWhen).toEqual({ prop: "mode", values: ["range"] });
    expect(byName["bare"]?.onlyWhen).toEqual({ prop: "mode", values: [], orOmitted: true });
  });

  it("reads a generic union in the source's order, its discriminant's values as written", () => {
    const docs = docsOf(
      "Value",
      [
        'export type ValueProps<T> = { readonly kind: "a"; readonly v: T } | { readonly kind: "b"; readonly v: T } | { readonly kind: "c" };',
        "export const Value = <T extends number>(props: ValueProps<T>) => null;",
        ""
      ].join("\n")
    );
    expect(docs.props.map((prop) => prop.name)).toEqual(["kind", "v"]);
    const [kind, v] = docs.props;
    expect(kind).toMatchObject({ type: '"a" | "b" | "c"', choices: ["a", "b", "c"] });
    expect(v).toMatchObject({
      kind: "number",
      type: "number",
      onlyWhen: { prop: "kind", values: ["a", "b"] }
    });
  });
});
