/**
 * SvelteKit's route ids, read as SvelteKit reads them: which route a path matches and with which params, and the path a
 * route id gives with its params filled in.
 *
 * @remarks
 * Pure: ids and paths in, matches out, so it is tested without a page. The ids are the project's own, listed from its
 * `src/routes` by the Vite plugin, so a story's links and `goto` calls land on the route SvelteKit would choose:
 * `/blog/[slug]` for `/blog/hello`, with `{ slug: "hello" }`. A param's matcher (`[id=integer]`) is not run, since the
 * catalogue does not load the project's matchers: any value matches it.
 *
 * @module
 */

import { byRouteOrder } from "./routeOrder.ts";

/** A route's params, by name: SvelteKit gives each as one text, a rest param's slashes included. */
export type RouteParams = Readonly<Record<string, string>>;

/** A route a path matched: its id and its params. */
export type RouteMatch = {
  /** The route's id (`/blog/[slug]`). */
  readonly id: string;
  /** The params read from the path. */
  readonly params: RouteParams;
};

/** A part of a route's segment: plain text, or a param. */
type SegmentPart =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "param";
      readonly name: string;
      readonly isRest: boolean;
      readonly isOptional: boolean;
    };

/** A param in a route id: `[name]`, `[[name]]`, `[...name]`, each with an optional `=matcher`. */
const PARAM = /\[(\[)?(\.\.\.)?([A-Za-z_$][\w$]*)(?:=[\w$]+)?\]?\]/g;

/** A layout group, `(app)`: a folder that is not a segment of the path. */
const GROUP = /^\(.+\)$/;

/**
 * The segments of a route id that are in its paths: its layout groups left out.
 *
 * @param id - the route's id (`/(app)/blog/[slug]`).
 */
const pathSegments = (id: string): string[] =>
  id.split("/").filter((segment) => segment !== "" && !GROUP.test(segment));

/**
 * A segment's parts: its texts and its params.
 *
 * @param segment - a segment of a route id (`[a]-[b]`).
 */
const segmentParts = (segment: string): SegmentPart[] => {
  const parts: SegmentPart[] = [];
  let index = 0;
  for (const match of segment.matchAll(PARAM)) {
    if (match.index > index) parts.push({ kind: "text", text: segment.slice(index, match.index) });
    parts.push({
      kind: "param",
      name: match[3] ?? "",
      isRest: match[2] !== undefined,
      isOptional: match[1] !== undefined
    });
    index = match.index + match[0].length;
  }
  if (index < segment.length) parts.push({ kind: "text", text: segment.slice(index) });
  return parts;
};

/**
 * A text written so a regular expression reads it as itself.
 *
 * @param text - the text.
 */
const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/**
 * The regular expression one segment of a route id matches, its slash included.
 *
 * @param parts - the segment's parts.
 * @param names - where its params' names are added, in order.
 */
const segmentSource = (parts: readonly SegmentPart[], names: string[]): string => {
  const only = parts.length === 1 ? parts[0] : undefined;
  // a segment that is a rest or optional param alone may be absent from the path, its slash with it
  if (only?.kind === "param" && (only.isRest || only.isOptional)) {
    names.push(only.name);
    return only.isRest ? "(?:/(.*))?" : "(?:/([^/]+))?";
  }
  const written = parts.map((part) => {
    if (part.kind === "text") return escaped(part.text);
    names.push(part.name);
    return part.isRest ? "(.*?)" : "([^/]+?)";
  });
  return `/${written.join("")}`;
};

/**
 * The regular expression a route id matches paths with, and its params' names in order.
 *
 * @param id - the route's id.
 */
const routePattern = (id: string): { readonly pattern: RegExp; readonly names: readonly string[] } => {
  const names: string[] = [];
  const source = pathSegments(id)
    .map((segment) => segmentSource(segmentParts(segment), names))
    .join("");
  return { pattern: new RegExp(`^${source}/?$`), names };
};

/**
 * A path's parts decoded, as SvelteKit decodes a param: a malformed escape left as it is.
 *
 * @param value - the text.
 */
const decoded = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/**
 * The route a path matches among a project's routes, and its params.
 *
 * @param routes - the project's route ids.
 * @param pathname - the path, without the base path (`/blog/hello`).
 * @returns the match, or none when no route matches.
 */
export const matchRoute = (routes: readonly string[], pathname: string): RouteMatch | undefined => {
  for (const id of [...routes].sort(byRouteOrder)) {
    const { pattern, names } = routePattern(id);
    const found = pattern.exec(pathname);
    if (found === null) continue;
    const params: Record<string, string> = {};
    names.forEach((name, index) => {
      params[name] = decoded(found[index + 1] ?? "");
    });
    return { id, params };
  }
  return undefined;
};

/**
 * The path a route id gives with its params filled in, as `resolve` from `$app/paths` writes it: the layout groups
 * left out, an optional or rest param with no value dropped with its slash.
 *
 * @param id - the route's id (`/blog/[slug]`).
 * @param params - the params, by name.
 * @returns the path (`/blog/hello`).
 */
export const filledRoute = (id: string, params: RouteParams): string => {
  const segments = pathSegments(id).flatMap((segment) => {
    const parts = segmentParts(segment);
    const text = parts
      .map((part) => {
        if (part.kind === "text") return part.text;
        // inserted as given, as SvelteKit's `resolve` does: the address the page builds from it encodes what it must
        return params[part.name] ?? "";
      })
      .join("");
    return text === "" ? [] : [text];
  });
  return `/${segments.join("/")}`;
};

/**
 * Whether a text is a route id rather than a path: it names a param or a layout group.
 *
 * @param text - the text.
 */
export const isRouteId = (text: string): boolean =>
  text
    .split("/")
    .some((segment) => GROUP.test(segment) || segmentParts(segment).some((part) => part.kind === "param"));
