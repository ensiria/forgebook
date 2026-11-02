/**
 * The route a story's components see, read from its `parameters.nextjs`, and where a link or a router call takes it:
 * one route that both of Next.js's routers read (`next/navigation`'s hooks and `next/router`'s `useRouter`).
 *
 * @remarks
 * Pure: parameters and hrefs in, routes out, so it is tested without a page. The parameters are read as Storybook's
 * Next.js framework writes them (`navigation` for the App Router, `router` for the Pages Router), so a story moved from
 * Storybook keeps its route; `params` is Forgebook's plain way to give the dynamic segments. Forgebook does not know the
 * app's routes, so a navigation keeps the story's params unless the href names its route
 * (`{ pathname: "/blog/[slug]", query: { slug: "x" } }`, as the Pages Router writes it).
 *
 * @module
 */

import type { RouteValue, RouteValues } from "./stories.ts";

/** Where a story's components are. */
export type StoryRoute = {
  /** The path, without the base path (`/blog/hello`). */
  readonly pathname: string;
  /** The search params, without the `?` (`tab=1`). */
  readonly search: string;
  /** The hash, with its `#`, or empty. */
  readonly hash: string;
  /** The dynamic segments' values, by name. */
  readonly params: RouteValues;
  /** The segments below the layout, for `useSelectedLayoutSegments`. */
  readonly segments: readonly string[];
  /** The Pages Router's route (`/blog/[slug]`): the path when the route is not known. */
  readonly route: string;
};

/** What a story's route does not change while it runs: the Pages Router's locales and flags. */
export type RouteSettings = {
  /** `router.locale`. */
  readonly locale: string | undefined;
  /** `router.locales`. */
  readonly locales: readonly string[] | undefined;
  /** `router.defaultLocale`. */
  readonly defaultLocale: string | undefined;
  /** `router.isFallback`. */
  readonly isFallback: boolean;
  /** `router.isPreview`. */
  readonly isPreview: boolean;
};

/** An href as Next.js takes it: a text, or a URL object (`{ pathname, query, hash }`). */
export type Href = string | HrefObject;

/** A URL object, as `next/link` and `router.push` take it. */
export type HrefObject = {
  /** The path, or the Pages Router's route with its dynamic segments in brackets. */
  readonly pathname?: string | null;
  /** The search params, by name; the route's params too, when the path is a route. */
  readonly query?: Readonly<Record<string, unknown>> | string | null;
  /** The search, with or without its `?`; read when there is no `query`. */
  readonly search?: string | null;
  /** The hash, with or without its `#`. */
  readonly hash?: string | null;
};

/** The route of a story that sets none. */
export const HOME_ROUTE: StoryRoute = {
  pathname: "/",
  search: "",
  hash: "",
  params: {},
  segments: [],
  route: "/"
};

/** The origin hrefs are resolved against: never fetched, only there so a relative href has a base. */
const BASE_ORIGIN = "http://forgebook.invalid";

/** A dynamic segment of a route: `[slug]`, `[...slug]` or `[[...slug]]`. */
const DYNAMIC_SEGMENT = /^\[{1,2}(\.\.\.)?([^\]]+)\]{1,2}$/;

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A route value, or none when the value is not one.
 *
 * @param value - a value read from a story's parameters.
 */
const routeValue = (value: unknown): RouteValue | undefined => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const texts: string[] = value.flatMap((item: unknown) =>
      typeof item === "string" || typeof item === "number" ? [String(item)] : []
    );
    return texts;
  }
  return undefined;
};

/**
 * The route values of an object read from a story's parameters: what is not a text or a list of texts left out.
 *
 * @param value - the object.
 */
const routeValues = (value: unknown): RouteValues =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).flatMap(([name, item]) => {
          const read = routeValue(item);
          return read === undefined ? [] : [[name, read]];
        })
      )
    : {};

/**
 * A text read from a story's parameters, or none.
 *
 * @param value - the value.
 */
const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/**
 * Search params written from values: a list repeats its name, as Next.js's query writer does.
 *
 * @param values - the values, by name.
 */
export const searchOf = (values: RouteValues): string => {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === "string") search.append(name, value);
    else for (const item of value) search.append(name, item);
  }
  return search.toString();
};

/**
 * Search params read as values: a name given more than once is a list.
 *
 * @param search - the search, without its `?`.
 */
export const valuesOfSearch = (search: string): RouteValues => {
  const values: Record<string, RouteValue> = {};
  for (const [name, value] of new URLSearchParams(search)) {
    const known = values[name];
    values[name] = known === undefined ? value : [...(typeof known === "string" ? [known] : known), value];
  }
  return values;
};

/**
 * The names of a route's dynamic segments, and whether each takes several values.
 *
 * @param route - the route (`/blog/[slug]`).
 */
const dynamicNames = (route: string): ReadonlyMap<string, boolean> =>
  new Map(
    route.split("/").flatMap((segment) => {
      const match = DYNAMIC_SEGMENT.exec(segment);
      return match?.[2] === undefined ? [] : [[match[2], match[1] !== undefined] as const];
    })
  );

/**
 * A route with its dynamic segments filled in from values; a segment with no value is dropped, as an optional
 * catch-all is.
 *
 * @param route - the route (`/blog/[slug]`).
 * @param values - the values, by name.
 * @returns the path (`/blog/hello`).
 */
export const filledRoute = (route: string, values: RouteValues): string => {
  const segments = route.split("/").flatMap((segment) => {
    const match = DYNAMIC_SEGMENT.exec(segment);
    if (match?.[2] === undefined) return [segment];
    const value = values[match[2]];
    if (value === undefined) return [];
    return (typeof value === "string" ? [value] : [...value]).map(encodeURIComponent);
  });
  const path = segments.join("/");
  return path === "" ? "/" : path;
};

/**
 * A path split into its path, search and hash.
 *
 * @param href - the path (`/blog/hello?tab=1#top`).
 * @param base - the path it is relative to.
 */
const parsedHref = (
  href: string,
  base: string
): { readonly pathname: string; readonly search: string; readonly hash: string } | undefined => {
  let url: URL;
  try {
    url = new URL(href, `${BASE_ORIGIN}${base}`);
  } catch {
    return undefined;
  }
  if (url.origin !== BASE_ORIGIN) return undefined;
  return { pathname: url.pathname, search: url.search.replace(/^\?/, ""), hash: url.hash };
};

/**
 * The segments and the params a story's `segments` give.
 *
 * @param segments - `navigation.segments`.
 */
const readSegments = (
  segments: unknown
): { readonly segments: readonly string[]; readonly params: RouteValues } => {
  if (isRecord(segments)) return { segments: [], params: routeValues(segments) };
  if (!Array.isArray(segments)) return { segments: [], params: {} };
  const names: string[] = [];
  const params: Record<string, RouteValue> = {};
  for (const segment of segments) {
    if (typeof segment === "string") names.push(segment);
    else if (Array.isArray(segment) && typeof segment[0] === "string") {
      const value = routeValue(segment[1]);
      if (value === undefined) continue;
      params[segment[0]] = value;
      names.push(typeof value === "string" ? value : value.join("/"));
    }
  }
  return { segments: names, params };
};

/**
 * The route a story's App Router parameters give.
 *
 * @param navigation - `parameters.nextjs.navigation`.
 * @param route - the Pages Router's route, when the story gives one too.
 */
const navigationRoute = (
  navigation: Readonly<Record<string, unknown>>,
  route: string | undefined
): StoryRoute => {
  const read = readSegments(navigation["segments"]);
  const pathname = textOf(navigation["pathname"]) ?? "/";
  const parsed = parsedHref(pathname, "/") ?? { pathname: "/", search: "", hash: "" };
  const query = searchOf(routeValues(navigation["query"]));
  return {
    pathname: parsed.pathname,
    search: query === "" ? parsed.search : query,
    hash: parsed.hash,
    params: { ...read.params, ...routeValues(navigation["params"]) },
    segments: read.segments,
    route: route ?? parsed.pathname
  };
};

/**
 * The route a story's Pages Router parameters give.
 *
 * @param router - `parameters.nextjs.router`.
 */
const routerRoute = (router: Readonly<Record<string, unknown>>): StoryRoute => {
  const route = textOf(router["pathname"]) ?? "/";
  const query = routeValues(router["query"]);
  const dynamic = dynamicNames(route);
  const params = Object.fromEntries(Object.entries(query).filter(([name]) => dynamic.has(name)));
  const rest = Object.fromEntries(Object.entries(query).filter(([name]) => !dynamic.has(name)));
  const asPath = textOf(router["asPath"]);
  const parsed =
    asPath === undefined ? undefined : (parsedHref(asPath, "/") ?? { pathname: "/", search: "", hash: "" });
  return {
    pathname: parsed?.pathname ?? filledRoute(route, params),
    search: parsed === undefined ? searchOf(rest) : parsed.search,
    hash: parsed?.hash ?? "",
    params,
    segments: [],
    route
  };
};

/**
 * The `nextjs` parameters of a story, or an empty object.
 *
 * @param parameters - the story's parameters (the preview's, the meta's and its own, merged).
 */
const nextjsParameters = (
  parameters: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const nextjs = parameters["nextjs"];
  return isRecord(nextjs) ? nextjs : {};
};

/**
 * The route a story starts at: its App Router's (`navigation`), else its Pages Router's (`router`), else `/`.
 *
 * @param parameters - the story's parameters.
 */
export const storyRouteOf = (parameters: Readonly<Record<string, unknown>>): StoryRoute => {
  const nextjs = nextjsParameters(parameters);
  const { navigation, router } = nextjs;
  if (isRecord(navigation))
    return navigationRoute(navigation, isRecord(router) ? textOf(router["pathname"]) : undefined);
  return isRecord(router) ? routerRoute(router) : HOME_ROUTE;
};

/**
 * The Pages Router's settings of a story: its locales and flags.
 *
 * @param parameters - the story's parameters.
 */
export const routeSettingsOf = (parameters: Readonly<Record<string, unknown>>): RouteSettings => {
  const router = nextjsParameters(parameters)["router"];
  const read = isRecord(router) ? router : {};
  const locales = read["locales"];
  return {
    locale: textOf(read["locale"]),
    locales: Array.isArray(locales) ? locales.filter((item) => typeof item === "string") : undefined,
    defaultLocale: textOf(read["defaultLocale"]),
    isFallback: read["isFallback"] === true,
    isPreview: read["isPreview"] === true
  };
};

/**
 * The route's path as the browser would show it: its path, search and hash.
 *
 * @param route - the route.
 */
export const hrefOfRoute = (route: StoryRoute): string =>
  `${route.pathname}${route.search === "" ? "" : `?${route.search}`}${route.hash}`;

/**
 * The query the Pages Router's `router.query` holds: the params and the search params.
 *
 * @param route - the route.
 */
export const pagesQueryOf = (route: StoryRoute): RouteValues => ({
  ...valuesOfSearch(route.search),
  ...route.params
});

/**
 * An href object's query as route values, and its search when the query is written as one.
 *
 * @param query - the object's `query`.
 */
const queryValues = (query: HrefObject["query"]): RouteValues => {
  if (typeof query === "string") return valuesOfSearch(query.replace(/^\?/, ""));
  return routeValues(query);
};

/**
 * An href written as a path: a URL object's path, query and hash, a route's dynamic segments filled in from its query.
 *
 * @param href - the href.
 * @returns the path (`/blog/hello?tab=1`), and the route when the href named one.
 */
export const hrefText = (href: Href): { readonly text: string; readonly route: string | undefined } => {
  if (typeof href === "string") return { text: href, route: undefined };
  const pathname = href.pathname ?? "";
  const values = queryValues(href.query);
  const dynamic = dynamicNames(pathname);
  const isRoute = dynamic.size > 0;
  const rest = Object.fromEntries(Object.entries(values).filter(([name]) => !dynamic.has(name)));
  // a search given wins over the query, as in Next.js's URL writer
  const givenSearch = (href.search ?? "").replace(/^\?/, "");
  const search = givenSearch === "" ? searchOf(rest) : givenSearch;
  const bareHash = (href.hash ?? "").replace(/^#/, "");
  const hash = bareHash === "" ? "" : `#${bareHash}`;
  const path = isRoute ? filledRoute(pathname, values) : pathname;
  return {
    text: `${path}${search === "" ? "" : `?${search}`}${hash}`,
    route: isRoute ? pathname : undefined
  };
};

/**
 * The route an href takes a story to, from where it is: a relative href is resolved against the route's path, the
 * story's params stay unless the href names a route.
 *
 * @param from - where the story is.
 * @param href - where to go.
 * @returns the route, or none for an href outside the app (another origin).
 */
export const routeAfter = (from: StoryRoute, href: Href): StoryRoute | undefined => {
  const { text, route } = hrefText(href);
  const parsed = parsedHref(text, hrefOfRoute(from));
  if (parsed === undefined) return undefined;
  if (route !== undefined) {
    const dynamic = dynamicNames(route);
    const values = typeof href === "string" ? {} : queryValues(href.query);
    const params = Object.fromEntries(Object.entries(values).filter(([name]) => dynamic.has(name)));
    return { ...parsed, params, segments: from.segments, route };
  }
  const isSamePath = parsed.pathname === from.pathname;
  return {
    ...parsed,
    params: from.params,
    segments: from.segments,
    route: isSamePath ? from.route : parsed.pathname
  };
};

/**
 * The route a Pages Router move takes a story to: the route and its params from the href, the path shown from `as`
 * when given, as Next.js's router takes them.
 *
 * @param from - where the story is.
 * @param href - where to go: a path or a route.
 * @param as - the path the browser shows, when the href names a route.
 * @returns the route, or none for an href outside the app.
 */
export const routeAfterAs = (from: StoryRoute, href: Href, as: Href | undefined): StoryRoute | undefined => {
  const routed = routeAfter(from, href);
  const shown = as === undefined ? undefined : routeAfter(from, as);
  if (routed === undefined || shown === undefined) return routed ?? shown;
  return { ...routed, pathname: shown.pathname, search: shown.search, hash: shown.hash };
};
