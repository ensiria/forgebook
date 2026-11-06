/**
 * Tests for the shape read from a component's types, through the docs a catalogue reads: a readonly list, an object with
 * optional members, a mixed union, a tuple, a record, what is too wide or recursive, and what JSON cannot hold.
 *
 * @module
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ts from "typescript-6";
import { afterAll, describe, expect, it } from "vitest";

import type { ValueShape } from "../src/valueShape.ts";
import { shapeOfProp } from "../src/vite/shapeDocs.ts";

const dir = mkdtempSync(join(tmpdir(), "forgebook-shapes-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** The shapes of the members of one type written in a new program, by member. */
const shapesOf = (text: string): Readonly<Record<string, ValueShape | undefined>> => {
  const file = join(dir, "props.ts");
  writeFileSync(file, text);
  const program = ts.createProgram([file], { strict: true, target: ts.ScriptTarget.ES2022, noLib: false });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(file);
  if (source === undefined) throw new Error("no source");
  const declaration = source.statements
    .filter(ts.isTypeAliasDeclaration)
    .find((each) => each.name.text === "P");
  if (declaration === undefined) throw new Error("no alias");
  const type = checker.getTypeAtLocation(declaration.name);
  return Object.fromEntries(
    type.getProperties().map((member) => [
      member.getName(),
      shapeOfProp(
        checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(member, source)),
        checker.isTypeAssignableTo(
          checker.getStringType(),
          checker.getTypeOfSymbolAtLocation(member, source)
        ),
        {
          checker,
          node: source,
          order: (values: readonly (string | number)[]): readonly (string | number)[] => values,
          typeText: (): undefined => undefined,
          description: (): string => ""
        }
      )
    ])
  );
};

describe("shapeOfProp", () => {
  it("reads lists, objects, tuples and records", () => {
    const shapes = shapesOf(`
      export type P = {
        tags: readonly string[];
        mutable: number[];
        address?: { readonly street: string; city?: string };
        rows: readonly { id: number; isDone?: boolean }[];
        pair: readonly [number, string];
        scores: Readonly<Record<string, number>>;
      };
    `);
    expect(shapes["tags"]).toEqual({ kind: "list", of: { kind: "text" } });
    expect(shapes["mutable"]).toEqual({ kind: "list", of: { kind: "number" } });
    expect(shapes["address"]).toEqual({
      kind: "object",
      fields: [
        { name: "street", shape: { kind: "text" }, isRequired: true },
        { name: "city", shape: { kind: "text" }, isRequired: false }
      ]
    });
    expect(shapes["rows"]).toMatchObject({ kind: "list", of: { kind: "object" } });
    expect(shapes["pair"]).toEqual({ kind: "tuple", items: [{ kind: "number" }, { kind: "text" }] });
    expect(shapes["scores"]).toEqual({ kind: "record", of: { kind: "number" } });
  });

  it("reads a mixed union as its literals, its toggle and its other members", () => {
    const shapes = shapesOf(`
      export type P = {
        size: "sm" | "md" | number;
        either: string | number;
        flag: boolean | "auto";
        many: string | readonly string[];
        branded: "a" | (string & {});
      };
    `);
    expect(shapes["size"]).toEqual({
      kind: "union",
      of: [{ kind: "choice", values: ["sm", "md"] }, { kind: "number" }]
    });
    expect(shapes["either"]).toMatchObject({ kind: "union" });
    expect(shapes["flag"]).toEqual({
      kind: "union",
      of: [{ kind: "choice", values: ["auto"] }, { kind: "boolean" }]
    });
    expect(shapes["many"]).toMatchObject({ kind: "union" });
    expect(shapes["branded"]).toMatchObject({ kind: "union" });
  });

  it("leaves out what no JSON can fill, and marks the part in an object that only a named value can", () => {
    const shapes = shapesOf(`
      type Icon = () => string;
      class Thing { go(): void {} }
      export type P = {
        icon: Icon;
        when: Date;
        map: Map<string, number>;
        thing: Thing;
        node: string | Icon;
        tile: { icon: Icon; label?: string };
      };
    `);
    expect(shapes["icon"]).toBeUndefined();
    expect(shapes["when"]).toBeUndefined();
    expect(shapes["map"]).toBeUndefined();
    expect(shapes["thing"]).toBeUndefined();
    expect(shapes["node"]).toBeUndefined();
    expect(shapes["tile"]).toMatchObject({
      kind: "object",
      fields: [{ name: "icon", shape: { kind: "named" }, isRequired: true }, { name: "label" }]
    });
  });

  it("ends a recursive type in JSON, and reads a very wide or untyped one as JSON", () => {
    const wide = Array.from({ length: 60 }, (_, index) => `f${index}?: string;`).join(" ");
    const shapes = shapesOf(`
      type Tree = { label: string; children?: readonly Tree[] };
      export type P = { tree: Tree; wide: { ${wide} }; free: unknown; loose: object; empty: {} };
    `);
    const text = JSON.stringify(shapes["tree"]);
    expect(text).toContain('"kind":"json"');
    expect(text.length).toBeLessThan(400);
    expect(shapes["wide"]).toEqual({ kind: "json" });
    expect(shapes["loose"]).toEqual({ kind: "json" });
    // `unknown` and `{}` take a text: their text field stays
    expect(shapes["free"]).toBeUndefined();
    expect(shapes["empty"]).toBeUndefined();
  });
});

describe("shapeOfProp, what a review of real types found", () => {
  it("reads an intersection as its object, a generic as JSON, and says which fields take null", () => {
    const shapes = shapesOf(`
      type Base = { id: number };
      export type P<T = unknown> = {
        both: Base & { label: string };
        some: { name: string | null };
        flag: { isOk: true; value: string } | { isOk: false };
      };
    `);
    expect(shapes["both"]).toMatchObject({
      kind: "object",
      fields: [{ name: "id" }, { name: "label" }]
    });
    expect(shapes["some"]).toEqual({
      kind: "object",
      fields: [{ name: "name", shape: { kind: "text" }, isRequired: true, isNullable: true }]
    });
    expect(shapes["flag"]).toMatchObject({
      kind: "union",
      of: [
        {
          kind: "object",
          fields: [{ name: "isOk", shape: { kind: "boolean", only: true } }, { name: "value" }]
        },
        { kind: "object", fields: [{ name: "isOk", shape: { kind: "boolean", only: false } }] }
      ]
    });
  });
});
