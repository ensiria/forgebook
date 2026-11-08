/**
 * Custom properties a browser gives no value: those whose references lead back to themselves, and those that read a
 * name with no fallback that nothing declares.
 *
 * @remarks
 * Pure. Resolving a token keeps the text of a reference it cannot follow (`cssTokenValues.ts`), since a browser may fill
 * it in later; that is right for a name code sets and wrong for a name nobody sets, which leaves the UI drawn with no
 * colour at all. A cycle is certain: the browser treats every property in it as invalid. A name declared nowhere is only
 * as certain as the caller's knowledge of what declares names, so the caller says which names are declared elsewhere.
 * References are followed within a theme, as the browser does.
 *
 * @module
 */
import { layerOf, type TokenDeclaration } from "./cssTokenValues.ts";

/** A `var()` in a value. */
export type CssReference = {
  /** The name it reads. */
  readonly name: string;
  /** Whether it has a fallback, which stands when the name has no value. */
  readonly hasFallback: boolean;
  /** Whether it sits inside another reference's fallback, so it is read only when that one has no value. */
  readonly isInFallback: boolean;
};

/** Why a declaration has no value. */
export type BrokenReference = {
  /** The declaration. */
  readonly declaration: TokenDeclaration;
  /** The theme where it breaks; none when it breaks in the base, and so wherever no theme fixes it. */
  readonly mode: string | undefined;
} & (
  | {
      /** Its references lead back to it. */
      readonly kind: "cycle";
      /** The other names in the cycle, in the order declared; none when it reads itself. */
      readonly through: readonly string[];
    }
  | {
      /** It reads, with no fallback, a name nothing declares. */
      readonly kind: "undeclared";
      /** That name. */
      readonly target: string;
    }
);

/** A union's members each without a field, which `Omit` over the union would merge. */
type DistributiveOmit<TValue, TKey extends PropertyKey> = TValue extends unknown ? Omit<TValue, TKey> : never;

/** A reference's start, a parenthesis or a comma: what tells a fallback from the rest of a value. */
const REFERENCE_PARTS = /var\(\s*(--[\w-]+)\s*(,?)|[(),]/g;

/**
 * The references a value holds, in order, with where each stands.
 *
 * @param value - a custom property's value, as written.
 */
export const references = (value: string): CssReference[] => {
  const found: CssReference[] = [];
  // each open reference: the depth of its parentheses, and whether its fallback has begun
  const open: { readonly depth: number; isInFallback: boolean }[] = [];
  let depth = 0;
  for (const [part, name, comma] of value.matchAll(REFERENCE_PARTS)) {
    const innermost = open.at(-1);
    if (name !== undefined) {
      const hasFallback = comma === ",";
      found.push({ name, hasFallback, isInFallback: open.some((each) => each.isInFallback) });
      depth += 1;
      open.push({ depth, isInFallback: hasFallback });
    } else if (part === "(") depth += 1;
    else if (part === "," && innermost?.depth === depth) innermost.isInFallback = true;
    else if (part === ")") {
      if (innermost?.depth === depth) open.pop();
      depth -= 1;
    }
  }
  return found;
};

/** Tarjan's walk over references: each name's order of discovery, the lowest it reaches, the open path. */
type Walk = {
  readonly order: Map<string, number>;
  readonly lowest: Map<string, number>;
  readonly stack: string[];
  readonly onStack: Set<string>;
  readonly groups: string[][];
};

/** A name reached for the first time. */
const enter = (walk: Walk, name: string): void => {
  const index = walk.order.size;
  walk.order.set(name, index);
  walk.lowest.set(name, index);
  walk.stack.push(name);
  walk.onStack.add(name);
};

/** What a name reaches, lowered. */
const lower = (walk: Walk, name: string, reached: number): void => {
  walk.lowest.set(name, Math.min(walk.lowest.get(name) ?? reached, reached));
};

/** A name whose references are all walked: when it is the first of its group, the group comes off the path. */
const close = (walk: Walk, name: string, readsItself: boolean): void => {
  if (walk.lowest.get(name) !== walk.order.get(name)) return;
  const group: string[] = [];
  for (let each = walk.stack.pop(); each !== undefined; each = walk.stack.pop()) {
    walk.onStack.delete(each);
    group.push(each);
    if (each === name) break;
  }
  if (group.length > 1 || readsItself) walk.groups.push(group);
};

/** Walks from one name, with a path of its own, since a long chain of references would run past the call stack. */
const walkFrom = (walk: Walk, edges: ReadonlyMap<string, readonly string[]>, start: string): void => {
  const path: { readonly name: string; next: number }[] = [{ name: start, next: 0 }];
  enter(walk, start);
  for (let top = path.at(-1); top !== undefined; top = path.at(-1)) {
    const targets = edges.get(top.name) ?? [];
    const target = targets[top.next];
    top.next += 1;
    if (target === undefined) {
      path.pop();
      const parent = path.at(-1);
      if (parent !== undefined) lower(walk, parent.name, walk.lowest.get(top.name) ?? 0);
      close(walk, top.name, targets.includes(top.name));
    } else if (edges.has(target) && !walk.order.has(target)) {
      enter(walk, target);
      path.push({ name: target, next: 0 });
    } else if (walk.onStack.has(target)) lower(walk, top.name, walk.order.get(target) ?? 0);
  }
};

/** The groups of names whose references lead back to each other, a name that reads itself included. */
const cycles = (edges: ReadonlyMap<string, readonly string[]>): string[][] => {
  const walk: Walk = { order: new Map(), lowest: new Map(), stack: [], onStack: new Set(), groups: [] };
  for (const start of edges.keys()) if (!walk.order.has(start)) walkFrom(walk, edges, start);
  return walk.groups;
};

/**
 * Whether a reference names the variable of the same name set elsewhere rather than the declaration itself: Tailwind's
 * `@theme inline { --font-sans: var(--font-sans); }` is how a theme takes a font a framework sets on the page, and
 * utilities read the outer variable. Anywhere else a declaration that reads itself is a cycle.
 */
const namesElsewhere = (declaration: TokenDeclaration, ref: CssReference): boolean =>
  declaration.origin.kind === "tailwind-theme" && ref.name === declaration.name;

/** What is broken in one theme's declarations. */
const brokenIn = (
  layer: ReadonlyMap<string, TokenDeclaration>,
  isDeclaredElsewhere: (name: string) => boolean
): DistributiveOmit<BrokenReference, "mode">[] => {
  const edges = new Map(
    [...layer].map(([name, each]) => [
      name,
      references(each.value).flatMap((ref) => (namesElsewhere(each, ref) ? [] : [ref.name]))
    ])
  );
  const broken: DistributiveOmit<BrokenReference, "mode">[] = [];
  const position = new Map([...layer.keys()].map((name, index) => [name, index]));
  const groupOf = new Map<string, readonly string[]>();
  for (const group of cycles(edges)) {
    const ordered = group.toSorted(
      (first, second) => (position.get(first) ?? 0) - (position.get(second) ?? 0)
    );
    for (const name of group) groupOf.set(name, ordered);
  }
  for (const [name, declaration] of layer) {
    const group = groupOf.get(name);
    if (group === undefined) continue;
    const through = [...group].filter((each) => each !== name);
    broken.push({ declaration, kind: "cycle", through });
  }
  for (const declaration of layer.values()) {
    const missing = references(declaration.value).find(
      (ref) =>
        !ref.hasFallback &&
        !ref.isInFallback &&
        (namesElsewhere(declaration, ref) || !layer.has(ref.name)) &&
        !isDeclaredElsewhere(ref.name)
    );
    if (missing !== undefined) broken.push({ declaration, kind: "undeclared", target: missing.name });
  }
  return broken;
};

/**
 * The declarations a browser gives no value, in the base and in each theme, each declaration and reason once.
 *
 * @param declarations - every declaration, the lowest priority first, as tokens are resolved from them.
 * @param isDeclaredElsewhere - whether a name these do not declare gets a value from elsewhere: another rule of a sheet,
 *   an installed package's sheet, code that sets it.
 */
export const brokenReferences = (
  declarations: readonly TokenDeclaration[],
  isDeclaredElsewhere: (name: string) => boolean
): BrokenReference[] => {
  const modes = [...new Set(declarations.flatMap((each) => (each.mode === undefined ? [] : [each.mode])))];
  const seen = new Set<TokenDeclaration>();
  return [undefined, ...modes].flatMap((mode) =>
    brokenIn(layerOf(declarations, mode), isDeclaredElsewhere).flatMap((broken): BrokenReference[] => {
      if (seen.has(broken.declaration)) return [];
      seen.add(broken.declaration);
      return [{ ...broken, mode }];
    })
  );
};
