/**
 * A story's router and request, while it is drawn: its route and the history a link or a router call moves through,
 * the calls the story made (a `router.push`, a `revalidatePath`), and the headers and cookies `next/headers` returns.
 *
 * @remarks
 * The router really moves: a link clicked in a story changes the path `usePathname` returns, so a navigation's
 * active item follows, and `back()` returns. The frame's own address never changes (it names the story). Each call is
 * also told to the catalogue, which lists it among the story's events.
 *
 * One frame draws one story, so the store of the story drawn last is the frame's current one: what reads it outside
 * React (`next/router`'s default export, `cookies()` in a server component, a play function) reads that one. The
 * current store sits on a global symbol, so two copies of this module (one pre-bundled with a dependency, one from
 * the sources) share it.
 *
 * @module
 */
import {
  HOME_ROUTE,
  type Href,
  hrefOfRoute,
  hrefText,
  type RouteSettings,
  routeAfterAs,
  routeSettingsOf,
  type StoryRoute,
  storyRouteOf
} from "./route.ts";
import type { NextCall } from "./storyRoute.ts";

/** The request a story's server code reads: `headers()`, `cookies()` and `draftMode()`. */
export type StoryRequest = {
  /** The request's headers. */
  readonly headers: Headers;
  /** The request's cookies, by name: a server action may set or delete one. */
  readonly cookies: Map<string, string>;
  /** Whether draft mode is on. */
  isDraftMode: boolean;
};

/** A story's router and request. */
export type RouteStore = {
  /** The route, as it is now. */
  readonly route: () => StoryRoute;
  /** The Pages Router's locales and flags. */
  readonly settings: RouteSettings;
  /** Calls a listener whenever the route changes; returns what stops it. */
  readonly subscribe: (listener: () => void) => () => void;
  /**
   * Goes to an href, as `router.push` or `router.replace` does.
   *
   * @returns whether the href is in the app: one outside it (another origin) leaves the route as it is.
   */
  readonly navigate: (method: "push" | "replace", href: Href, as?: Href) => boolean;
  /** Moves through the history, as `router.back` and `router.forward` do. */
  readonly go: (step: -1 | 1) => void;
  /** Records a call and tells the catalogue. */
  readonly record: (name: string, values: readonly unknown[]) => void;
  /** The calls the story made, in order. */
  readonly calls: () => readonly NextCall[];
  /** The request its server code reads. */
  readonly request: StoryRequest;
};

/** Tells the catalogue about a call: the frame's event report, when the catalogue gives one. */
export type EventReport = (name: string, values: readonly unknown[]) => void;

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The texts of an object read from a story's parameters, by name.
 *
 * @param value - the object.
 */
const textsOf = (value: unknown): [string, string][] =>
  isRecord(value)
    ? Object.entries(value).flatMap(([name, item]) => (typeof item === "string" ? [[name, item]] : []))
    : [];

/**
 * The request a story's parameters give: `nextjs.headers`, `nextjs.cookies` and `nextjs.draftMode`.
 *
 * @param parameters - the story's parameters.
 */
const requestOf = (parameters: Readonly<Record<string, unknown>>): StoryRequest => {
  const nextjs = isRecord(parameters["nextjs"]) ? parameters["nextjs"] : {};
  return {
    headers: new Headers(textsOf(nextjs["headers"])),
    cookies: new Map(textsOf(nextjs["cookies"])),
    isDraftMode: nextjs["draftMode"] === true
  };
};

/**
 * A story's router and request.
 *
 * @param parameters - the story's parameters, which give its route and request.
 * @param report - tells the catalogue about each call; none outside a catalogue.
 */
export const createRouteStore = (
  parameters: Readonly<Record<string, unknown>>,
  report: EventReport | undefined
): RouteStore => {
  const history: StoryRoute[] = [storyRouteOf(parameters)];
  let index = 0;
  const listeners = new Set<() => void>();
  const made: NextCall[] = [];
  const changed = (): void => {
    for (const listener of listeners) listener();
  };
  const record = (name: string, values: readonly unknown[]): void => {
    made.push({ name, values });
    report?.(name, values);
  };
  const route = (): StoryRoute => history[index] ?? HOME_ROUTE;
  return {
    route,
    settings: routeSettingsOf(parameters),
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
    navigate: (method: "push" | "replace", href: Href, as?: Href): boolean => {
      record(`router.${method}`, [hrefText(as ?? href).text]);
      const next = routeAfterAs(route(), href, as);
      if (next === undefined) return false;
      if (hrefOfRoute(next) === hrefOfRoute(route()) && next.route === route().route) return true;
      if (method === "push") {
        history.splice(index + 1, history.length, next);
        index += 1;
      } else history[index] = next;
      changed();
      return true;
    },
    go: (step: -1 | 1): void => {
      record(step === -1 ? "router.back" : "router.forward", []);
      const target = index + step;
      if (target < 0 || target >= history.length) return;
      index = target;
      changed();
    },
    record,
    calls: (): readonly NextCall[] => [...made],
    request: requestOf(parameters)
  };
};

/** Where the frame's current store is kept: one key for every copy of this module. */
const CURRENT_KEY = Symbol.for("forgebook.nextjs.route-store");

/** The store a frame has before any story is drawn, and outside a catalogue: `/`, no request. */
const IDLE_STORE = createRouteStore({}, undefined);

/**
 * Makes a store the frame's current one: the story drawn last.
 *
 * @param store - the store.
 */
export const setCurrentStore = (store: RouteStore): void => {
  Reflect.set(globalThis, CURRENT_KEY, store);
};

/** Whether a value is a store this module made. */
const isRouteStore = (value: unknown): value is RouteStore =>
  isRecord(value) && typeof value["route"] === "function" && typeof value["navigate"] === "function";

/** The frame's current store: the story drawn last, or an idle one at `/`. */
export const currentStore = (): RouteStore => {
  const store: unknown = Reflect.get(globalThis, CURRENT_KEY);
  return isRouteStore(store) ? store : IDLE_STORE;
};
