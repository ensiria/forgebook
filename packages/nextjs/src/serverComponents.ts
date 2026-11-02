/**
 * Server components in a story: each async component is drawn by a component that waits for its result, as Next.js's
 * server waits for it before it sends the page, so what React draws is a tree the browser can draw.
 *
 * @remarks
 * A server component is an async function, and React draws one only on a server (React 19 tries it in the browser, with
 * an error in the console and the function called again on each try). Here an async component is swapped for a
 * stand-in that calls it once per set of props, suspends on its promise, then draws its result, the async components in
 * that result swapped too. The renderer's boundary takes the suspension, and the story counts as drawn once they all
 * came (`nextRenderer.tsx`).
 *
 * The swap reaches the story's component, what its render returns, and what the catalogue's decorators return: the
 * elements, and the elements in their props. An async component a synchronous one creates while it renders is out of
 * reach (a client component's own body): React 19 draws it as it does in the browser. What the server code reaches is
 * not there either (a database, the file system): `fetch` is mocked with `parameters.msw`, other modules with a
 * story's stand-ins.
 *
 * @module
 */
import { cloneElement, createElement, isValidElement, type ReactNode, use } from "react";

/** An async component: a server component. */
type AsyncComponent = (props: Readonly<Record<string, unknown>>) => Promise<unknown>;

/**
 * Whether a value is a server component: an async function.
 *
 * @param value - an element's type, or a story's component.
 */
export const isAsyncComponent = (value: unknown): value is AsyncComponent =>
  typeof value === "function" && Object.prototype.toString.call(value) === "[object AsyncFunction]";

/**
 * Whether a value is something React draws: a text, a number, nothing, an element, a portal or a list of them.
 *
 * @param value - the value.
 */
export const isDrawable = (value: unknown): value is ReactNode => {
  if (value === null || value === undefined) return true;
  if (["string", "number", "boolean", "bigint"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isDrawable);
  if (value instanceof Promise) return true;
  // an element, a portal or a lazy component: React marks each with its own symbol
  return typeof value === "object" && "$$typeof" in value;
};

/** The stand-in of each server component, so an element keeps its type from one draw to the next. */
const standIns = new WeakMap<AsyncComponent, (props: Readonly<Record<string, unknown>>) => ReactNode>();

/** The results of each server component, with the props each was called with. */
const results = new WeakMap<
  AsyncComponent,
  { readonly props: Readonly<Record<string, unknown>>; readonly result: Promise<unknown> }[]
>();

/** How many results of one component are kept: a story draws a few, a matrix one per cell. */
const KEPT_RESULTS = 32;

/**
 * Whether two values are the same for a server component: the same value, or elements of the same type, key and props.
 *
 * @remarks
 * A decorator that draws the story as a component (`<Story />`) makes the story's elements anew each time React tries
 * it again, so the props of a retry are new objects holding the same values: compared by identity, each retry would
 * call the server component again and never finish.
 *
 * @param first - a value.
 * @param second - another.
 */
const isSame = (first: unknown, second: unknown): boolean => {
  if (Object.is(first, second)) return true;
  if (Array.isArray(first) && Array.isArray(second))
    return first.length === second.length && first.every((item, index) => isSame(item, second[index]));
  if (
    !isValidElement<Readonly<Record<string, unknown>>>(first) ||
    !isValidElement<Readonly<Record<string, unknown>>>(second)
  )
    return false;
  return first.type === second.type && first.key === second.key && hasSameProps(first.props, second.props);
};

/**
 * Whether two props objects hold the same values.
 *
 * @param first - props.
 * @param second - other props.
 */
const hasSameProps = (
  first: Readonly<Record<string, unknown>>,
  second: Readonly<Record<string, unknown>>
): boolean => {
  const names = Object.keys(first);
  return (
    names.length === Object.keys(second).length && names.every((name) => isSame(first[name], second[name]))
  );
};

/**
 * A server component's result for some props: the one already asked for with the same props, or a new call.
 *
 * @param component - the server component.
 * @param props - its props.
 */
const resultOf = (component: AsyncComponent, props: Readonly<Record<string, unknown>>): Promise<unknown> => {
  const known = results.get(component) ?? [];
  const found = known.find((entry) => hasSameProps(entry.props, props));
  if (found !== undefined) return found.result;
  const result = component(props).then(withServerComponents);
  results.set(component, [{ props, result }, ...known].slice(0, KEPT_RESULTS));
  return result;
};

/**
 * The component that draws a server component: it calls it once per set of props, waits, and draws what it returned.
 *
 * @param component - the server component.
 */
export const serverComponentStandIn = (
  component: AsyncComponent
): ((props: Readonly<Record<string, unknown>>) => ReactNode) => {
  const known = standIns.get(component);
  if (known !== undefined) return known;
  // biome-ignore lint/correctness/noComponentHookFactories: one stand-in per server component, kept, so an element keeps its type from one draw to the next
  const StandIn = (props: Readonly<Record<string, unknown>>): ReactNode => {
    const drawn = use(resultOf(component, props));
    return isDrawable(drawn) ? drawn : null;
  };
  // the stand-in shows as the component in React's tools and errors
  Object.defineProperty(StandIn, "name", { value: component.name });
  standIns.set(component, StandIn);
  return StandIn;
};

/**
 * A node with each server component in it swapped for its stand-in: the elements, and the elements in their props, at
 * any depth. What holds none is kept as it is.
 *
 * @param node - the node.
 */
export const withServerComponents = (node: unknown): unknown => {
  if (Array.isArray(node)) {
    const items = node.map(withServerComponents);
    return items.some((item, index) => item !== node[index]) ? items : node;
  }
  if (!isValidElement<Readonly<Record<string, unknown>>>(node)) return node;
  const changed = Object.entries(node.props).flatMap(([name, value]) => {
    const swapped = withServerComponents(value);
    return swapped === value ? [] : [[name, swapped] as const];
  });
  if (isAsyncComponent(node.type))
    return createElement(serverComponentStandIn(node.type), {
      ...node.props,
      ...Object.fromEntries(changed),
      ...(node.key === null ? {} : { key: node.key })
    });
  return changed.length === 0 ? node : cloneElement(node, Object.fromEntries(changed));
};
