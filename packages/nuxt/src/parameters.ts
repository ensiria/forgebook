/**
 * A story's Nuxt settings (`parameters.nuxt`), read from the story's parameters: where it starts, the data, state and
 * cookies its composables find, and the config over the project's.
 *
 * @remarks
 * Pure: the parameters are values a story file wrote, typed `unknown` by the frame, so each is read with what it must
 * be and anything else left out. A route is kept as a path, or as a location by path or by name, which is what
 * vue-router resolves.
 *
 * @module
 */

/** A route's query or params: a text, or several, by name. */
export type RouteValues = Record<string, string | string[]>;

/** Where a story starts: a path (`/blog/hello?tab=1`), or a location by path or by a route's name. */
export type StoryLocation =
  | string
  | {
      /** The path. */
      readonly path: string;
      /** The search params, by name. */
      readonly query?: RouteValues;
      /** The hash, with its `#`. */
      readonly hash?: string;
    }
  | {
      /** The route's name, as Nuxt names it from its file (`blog-slug`). */
      readonly name: string;
      /** The route's params (`{ slug: "hello" }`). */
      readonly params?: RouteValues;
      /** The search params, by name. */
      readonly query?: RouteValues;
      /** The hash, with its `#`. */
      readonly hash?: string;
    };

/** A story's Nuxt settings, read. */
export type StoryNuxt = {
  /** Where the story starts; `/` when it says nothing. */
  readonly route: StoryLocation;
  /** What `useAsyncData` and `useFetch` return, by key, instead of calling their handler. */
  readonly data: Readonly<Record<string, unknown>>;
  /** What `useState` starts with, by key. */
  readonly state: Readonly<Record<string, unknown>>;
  /** What `useCookie` reads, by name. */
  readonly cookies: Readonly<Record<string, unknown>>;
  /** The public runtime config over the project's. */
  readonly publicRuntimeConfig: Readonly<Record<string, unknown>>;
  /** The app config over the project's. */
  readonly appConfig: Readonly<Record<string, unknown>>;
};

/** Whether a value is a plain object. */
export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * An object read from a story's parameters, or an empty one.
 *
 * @param value - the value.
 */
const recordOf = (value: unknown): Readonly<Record<string, unknown>> => (isRecord(value) ? value : {});

/**
 * A query or params read from a story's parameters: what is not a text, a number or a list of them left out.
 *
 * @param value - the value.
 */
const routeValues = (value: unknown): RouteValues =>
  Object.fromEntries(
    Object.entries(recordOf(value)).flatMap(([name, item]): [string, string | string[]][] => {
      if (typeof item === "string" || typeof item === "number") return [[name, String(item)]];
      if (Array.isArray(item))
        return [
          [
            name,
            item.flatMap((each: unknown) =>
              typeof each === "string" || typeof each === "number" ? [String(each)] : []
            )
          ]
        ];
      return [];
    })
  );

/**
 * The hash of a location read from a story's parameters, when it gives one.
 *
 * @param location - the location.
 */
const hashOf = (location: Readonly<Record<string, unknown>>): { readonly hash?: string } =>
  typeof location["hash"] === "string" ? { hash: location["hash"] } : {};

/**
 * Where a story starts, read from its `nuxt.route`: `/` for anything that is not a path or a location.
 *
 * @param value - `nuxt.route`.
 */
export const storyLocationOf = (value: unknown): StoryLocation => {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return "/";
  const query = routeValues(value["query"]);
  if (typeof value["name"] === "string")
    return { name: value["name"], params: routeValues(value["params"]), query, ...hashOf(value) };
  if (typeof value["path"] === "string") return { path: value["path"], query, ...hashOf(value) };
  return "/";
};

/**
 * A story's Nuxt settings, from its parameters (the preview's, the meta's and its own, merged).
 *
 * @param parameters - the story's parameters.
 */
export const storyNuxtOf = (parameters: Readonly<Record<string, unknown>>): StoryNuxt => {
  const nuxt = recordOf(parameters["nuxt"]);
  return {
    route: storyLocationOf(nuxt["route"]),
    data: recordOf(nuxt["data"]),
    state: recordOf(nuxt["state"]),
    cookies: recordOf(nuxt["cookies"]),
    publicRuntimeConfig: recordOf(recordOf(nuxt["runtimeConfig"])["public"]),
    appConfig: recordOf(nuxt["appConfig"])
  };
};

/**
 * Two objects merged, the second's values over the first's and objects merged in depth, as Nuxt merges its configs.
 *
 * @param base - the first.
 * @param over - the second.
 */
export const mergedRecords = (
  base: Readonly<Record<string, unknown>>,
  over: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const merged: Record<string, unknown> = { ...base };
  for (const [name, value] of Object.entries(over)) {
    const known = merged[name];
    merged[name] = isRecord(known) && isRecord(value) ? mergedRecords(known, value) : value;
  }
  return merged;
};
