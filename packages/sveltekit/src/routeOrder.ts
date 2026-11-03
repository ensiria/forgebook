/**
 * The order SvelteKit tries its routes in, so a path two routes match lands on the one SvelteKit would choose.
 *
 * @remarks
 * SvelteKit's own `sort_routes` (MIT), written again in this package's TypeScript: the rules are SvelteKit's to the
 * letter, since a route chosen otherwise gives a component other params than the app would. A text segment outranks a
 * param, a param with a matcher one without, a required param an optional one, `[...rest]/x` a plain param; a shallower
 * path a deeper one; an optional param that is not last is left out of the comparison.
 *
 * @module
 */

/** A part of a route's segment, as SvelteKit's sort reads it. */
type Part = {
  /** What the part is. */
  readonly type: "static" | "required" | "optional" | "rest";
  /** Its text, brackets included for a param. */
  readonly content: string;
  /** Whether a param has a matcher (`[id=integer]`). */
  readonly isMatched: boolean;
};

/** The part a segment past a route's end compares as. */
const EMPTY: Part = { type: "static", content: "", isMatched: false };

/** A param's type, by the character after its `[`: `[[optional]]`, `[...rest]`, any other `[required]`. */
const PARAM_TYPES: Readonly<Record<string, Part["type"]>> = { "[": "optional", ".": "rest" };

/** A layout group, `(app)`: a folder that is not a segment of the path. */
const GROUP = /^\(.+\)$/;

/**
 * A segment's parts: a text first (empty when the segment opens with a param), then params and texts in turn.
 *
 * @param segment - the segment.
 */
const partsOf = (segment: string): Part[] => {
  const parts: Part[] = [];
  let index = 0;
  while (index <= segment.length) {
    const start = segment.indexOf("[", index);
    if (start === -1) {
      parts.push({ type: "static", content: segment.slice(index), isMatched: false });
      break;
    }
    parts.push({ type: "static", content: segment.slice(index, start), isMatched: false });
    const type = PARAM_TYPES[segment[start + 1] ?? ""] ?? "required";
    const delimiter = type === "optional" ? "]]" : "]";
    const end = segment.indexOf(delimiter, start);
    if (end === -1) return [{ type: "static", content: segment, isMatched: false }];
    index = end + delimiter.length;
    const content = segment.slice(start, index);
    parts.push({ type, content, isMatched: content.includes("=") });
  }
  return parts;
};

/**
 * A route id's segments as the sort compares them: an optional param that is not at the end left out, groups too.
 *
 * @param id - the route id.
 */
const sortedSegments = (id: string): Part[][] =>
  id
    .replace(/\[\[[^\]]+\]\](?!(?:\/\([^/]+\))*$)/g, "")
    .slice(1)
    .split("/")
    .filter((segment) => segment !== "" && !GROUP.test(segment))
    .map(partsOf);

/**
 * Orders two texts as SvelteKit does: by their characters, except that `foobar` outranks `foo`.
 *
 * @param first - a text.
 * @param second - another.
 */
const byText = (first: string, second: string): number => {
  for (let index = 0; ; index += 1) {
    const a = first[index];
    const b = second[index];
    if (a === b) {
      if (a === undefined) return 0;
      continue;
    }
    if (a === undefined) return 1;
    if (b === undefined) return -1;
    return a < b ? -1 : 1;
  }
};

/**
 * Orders two params at the same place of two routes, or none when they rank the same.
 *
 * @param a - the first route's param.
 * @param b - the second's.
 * @param nextA - the text after the first's, in its segment or the next.
 * @param nextB - the text after the second's.
 */
const byParam = (a: Part, b: Part, nextA: string, nextB: string): number | undefined => {
  if (a.type === "rest" || b.type === "rest") return byRest(a, b, nextA, nextB);
  if (a.isMatched !== b.isMatched) return a.isMatched ? -1 : 1;
  if (a.type !== b.type) {
    if (a.type === "required") return -1;
    if (b.type === "required") return 1;
  }
  return undefined;
};

/**
 * Orders two params at the same place when one is a rest param: `[...rest]/x` outranks a plain param, which outranks
 * a bare `[...rest]`.
 *
 * @param a - the first route's param.
 * @param b - the second's.
 * @param nextA - the text after the first's.
 * @param nextB - the text after the second's.
 */
const byRest = (a: Part, b: Part, nextA: string, nextB: string): number | undefined => {
  if (a.type === "rest" && b.type === "rest") {
    if (nextA !== "" && nextB !== "") return undefined;
    if (nextA !== "") return -1;
    return nextB !== "" ? 1 : undefined;
  }
  if (a.type === "rest") return nextA !== "" && nextB === "" ? -1 : 1;
  return nextB !== "" && nextA === "" ? 1 : -1;
};

/**
 * The text that follows a part: the next part of its segment, or the first of the next segment.
 *
 * @param segments - the route's segments.
 * @param segment - the part's segment.
 * @param part - the part.
 */
const nextText = (segments: readonly Part[][], segment: number, part: number): string =>
  segments[segment]?.[part + 1]?.content || segments[segment + 1]?.[0]?.content || "";

/**
 * Orders two segments at the same place of two routes, or none when they rank the same.
 *
 * @param segmentsA - the first route's segments.
 * @param segmentsB - the second's.
 * @param index - the segments' place.
 */
const bySegment = (
  segmentsA: readonly Part[][],
  segmentsB: readonly Part[][],
  index: number
): number | undefined => {
  const segmentA = segmentsA[index] ?? [EMPTY];
  const segmentB = segmentsB[index] ?? [EMPTY];
  for (let part = 0; part < Math.max(segmentA.length, segmentB.length); part += 1) {
    const order = byPart(segmentA[part], segmentB[part], part % 2 === 1, () => [
      nextText(segmentsA, index, part),
      nextText(segmentsB, index, part)
    ]);
    if (order !== undefined) return order;
  }
  return undefined;
};

/**
 * Orders two parts at the same place of two segments, or none when they rank the same.
 *
 * @param a - the first segment's part, or none past its end.
 * @param b - the second's.
 * @param isParam - whether the place holds params: a segment starts with a text, maybe empty, then alternates.
 * @param nextTexts - the texts after each param.
 */
const byPart = (
  a: Part | undefined,
  b: Part | undefined,
  isParam: boolean,
  nextTexts: () => readonly [string, string]
): number | undefined => {
  if (isParam) {
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    const [nextA, nextB] = nextTexts();
    return byParam(a, b, nextA, nextB);
  }
  if (a?.content === b?.content) return undefined;
  if (a === undefined || a === EMPTY) return -1;
  if (b === undefined || b === EMPTY) return 1;
  return byText(a.content, b.content);
};

/**
 * Orders two routes, the one SvelteKit tries first first.
 *
 * @param first - a route id.
 * @param second - another.
 */
export const byRouteOrder = (first: string, second: string): number => {
  const segmentsA = sortedSegments(first);
  const segmentsB = sortedSegments(second);
  for (let index = 0; index < Math.max(segmentsA.length, segmentsB.length); index += 1) {
    const order = bySegment(segmentsA, segmentsB, index);
    if (order !== undefined) return order;
  }
  return first < second ? 1 : -1;
};
