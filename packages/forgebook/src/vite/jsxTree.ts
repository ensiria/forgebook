/**
 * The JSX of a script as what stands where: which elements are directly inside which, and what is written in a place that
 * says nothing of where it will be drawn (a prop, a value kept for later).
 *
 * @module
 */
import { lineAt } from "./sourceText.ts";

/** A JSX element, as this walks it. */
export type Element = {
  /** Its name. */
  readonly name: string;
  /** Its line. */
  readonly line: number;
  /** The elements directly inside it, through fragments. */
  readonly children: readonly Element[];
  /** Whether nothing of it shows, or what it is cannot be told: no system's component stands in for that. */
  readonly isOutOfSight: boolean;
  /** Whether it is one branch of a condition, so what stands in the other is no sibling of it. */
  readonly isAlternative: boolean;
};

/** The elements a part of the tree comes to, and what else it holds that stands nowhere known. */
type Reading = { readonly direct: readonly Element[]; readonly detached: readonly Element[] };

/** Elements that stand for what is inside them and say nothing of what a component stands in. */
const TRANSPARENT = /^(?:React\.)?(?:Fragment|Suspense|StrictMode|Profiler)$|(?:Provider|Consumer|Boundary)$/;

/** Whether a value is a node of the tree. */
const isNode = (value: unknown): value is { readonly type: string } & Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";

/** A JSX name as text. */
const nameOf = (node: unknown): string | undefined => {
  if (!isNode(node)) return undefined;
  if (node.type === "JSXIdentifier" && typeof node["name"] === "string") return node["name"];
  if (node.type !== "JSXMemberExpression") return undefined;
  const [object, property] = [nameOf(node["object"]), nameOf(node["property"])];
  return object === undefined || property === undefined ? undefined : `${object}.${property}`;
};

/** A plain attribute's text; none when it is absent, empty when written by code. */
const attributeText = (attributes: readonly unknown[], name: string): string | undefined => {
  for (const each of attributes) {
    if (!isNode(each) || !isNode(each["name"]) || each["name"]["name"] !== name) continue;
    const value = each["value"];
    return isNode(value) && typeof value["value"] === "string" ? value["value"] : "";
  }
  return undefined;
};

/** Whether an element's attributes say nothing of it shows, or hand what it is to code (`{...getInputProps()}`). */
const isOutOfSight = (attributes: unknown): boolean => {
  const list: readonly unknown[] = Array.isArray(attributes) ? attributes : [];
  if (list.some((each) => isNode(each) && each.type === "JSXSpreadAttribute")) return true;
  const type = attributeText(list, "type");
  if (type === "hidden" || type === "file" || attributeText(list, "hidden") !== undefined) return true;
  return /(?:^|\s)(?:sr-only|hidden)(?:\s|$)/.test(attributeText(list, "className") ?? "");
};

/** Two readings or more as one. */
const joined = (readings: readonly Reading[]): Reading => ({
  direct: readings.flatMap((each) => each.direct),
  detached: readings.flatMap((each) => each.detached)
});

/** Every outermost element under a node, standing nowhere known. */
const anyElements = (node: unknown, starts: readonly number[]): Element[] => {
  if (Array.isArray(node)) return node.flatMap((each) => anyElements(each, starts));
  if (typeof node !== "object" || node === null) return [];
  if (isNode(node) && (node.type === "JSXElement" || node.type === "JSXFragment")) {
    const { direct, detached } = readValue(node, starts);
    return [...direct, ...detached];
  }
  return Object.values(node).flatMap((value) =>
    typeof value === "object" ? anyElements(value, starts) : []
  );
};

/** What stands under a part of the tree. */
const childrenOfNode = (node: unknown): readonly unknown[] => {
  if (Array.isArray(node)) return node;
  return typeof node === "object" && node !== null
    ? Object.values(node).filter((value) => typeof value === "object")
    : [];
};

/** What a function gives back, as elements: its expression, or its own returns. */
const readReturns = (body: unknown, starts: readonly number[]): Reading => {
  if (!isNode(body) || body.type !== "BlockStatement") return readValue(body, starts);
  const returned: unknown[] = [];
  const others: unknown[] = [];
  const visit = (node: unknown): void => {
    if (isNode(node) && node.type === "ReturnStatement") returned.push(node["argument"]);
    else if (isNode(node) && (node.type === "JSXElement" || node.type === "JSXFragment")) others.push(node);
    else childrenOfNode(node).forEach(visit);
  };
  visit(body["body"]);
  const given = joined(returned.map((each) => readValue(each, starts)));
  return { direct: given.direct, detached: [...given.detached, ...anyElements(others, starts)] };
};

/** A call's elements: `items.map((item) => <Option />)` stands where it is written; another's argument may go anywhere. */
const readCall = (node: Readonly<Record<string, unknown>>, starts: readonly number[]): Reading => {
  const callee = node["callee"];
  const method = isNode(callee) && isNode(callee["property"]) ? callee["property"]["name"] : undefined;
  const parts = Array.isArray(node["arguments"]) ? node["arguments"] : [];
  return method === "map" || method === "flatMap"
    ? readValue(parts, starts)
    : { direct: [], detached: anyElements(parts, starts) };
};

/** An element and what it holds. What its props hold (`icon={<X />}`, `render={() => …}`) may be drawn anywhere. */
const readElement = (node: Readonly<Record<string, unknown>>, starts: readonly number[]): Reading => {
  const opening = node["openingElement"];
  const name = isNode(opening) ? nameOf(opening["name"]) : undefined;
  const inner = readValue(node["children"], starts);
  const held = isNode(opening) ? anyElements(opening["attributes"], starts) : [];
  if (name === undefined || !isNode(opening) || TRANSPARENT.test(name)) {
    return { direct: inner.direct, detached: [...inner.detached, ...held] };
  }
  const element: Element = {
    name,
    line: lineAt(starts, Number(opening["start"])),
    children: inner.direct,
    isOutOfSight: isOutOfSight(opening["attributes"]),
    isAlternative: false
  };
  return { direct: [element], detached: [...inner.detached, ...held] };
};

/** The elements an expression comes to, through what JSX writes around them. */
const readValue = (node: unknown, starts: readonly number[]): Reading => {
  if (Array.isArray(node)) return joined(node.map((each) => readValue(each, starts)));
  if (!isNode(node)) return { direct: [], detached: [] };
  switch (node.type) {
    case "JSXElement":
      return readElement(node, starts);
    case "JSXFragment":
      return readValue(node["children"], starts);
    case "JSXExpressionContainer":
    case "ParenthesizedExpression":
    case "TSAsExpression":
    case "TSNonNullExpression":
      return readValue(node["expression"], starts);
    case "ConditionalExpression": {
      const branches = joined([readValue(node["consequent"], starts), readValue(node["alternate"], starts)]);
      return {
        direct: branches.direct.map((each) => ({ ...each, isAlternative: true })),
        detached: branches.detached
      };
    }
    case "LogicalExpression":
      return readValue(node["right"], starts);
    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return readReturns(node["body"], starts);
    case "CallExpression":
      return readCall(node, starts);
    default:
      return { direct: [], detached: anyElements(node, starts) };
  }
};

/**
 * The roots of a file: each outermost piece of markup, whose elements stand together with nothing known above them.
 *
 * @param node - the file's tree.
 * @param starts - where its lines start.
 */
export const rootsOf = (node: unknown, starts: readonly number[]): (readonly Element[])[] => {
  if (Array.isArray(node)) return node.flatMap((each) => rootsOf(each, starts));
  if (typeof node !== "object" || node === null) return [];
  if (isNode(node) && (node.type === "JSXElement" || node.type === "JSXFragment")) {
    const { direct, detached } = readValue(node, starts);
    return [direct, ...detached.map((each) => [each])];
  }
  return Object.values(node).flatMap((value) => (typeof value === "object" ? rootsOf(value, starts) : []));
};
