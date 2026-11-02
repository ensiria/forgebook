/**
 * A story's SvelteKit settings, read from its `parameters.sveltekit`: the page its components see (`$app/state`'s
 * `page`), the `load` that gives the page its data, and what a navigation, a link or a form calls.
 *
 * @remarks
 * Pure: parameters in, settings out, so it is tested without a page. Storybook's `sveltekit_experimental` is read
 * too, as its SvelteKit framework writes it (`state.page`, `stores.page`, `navigation`, `forms`, `hrefs`), so a story
 * moved from Storybook keeps its page; `sveltekit` wins where both are given. The page's path is matched against the
 * project's routes, so a story that gives only `url: "/blog/hello"` gets the route id and the params SvelteKit would.
 *
 * @module
 */
import { filledRoute, matchRoute, type RouteParams } from "./routeIds.ts";

/** An error as `page.error` holds it (`App.Error`): its message, and its status in SvelteKit 3. */
export type KitError = {
  /** The error's message. */
  readonly message: string;
  /** Its HTTP status. */
  readonly status?: number;
};

/** The page a story's components see, as `page` from `$app/state` holds it. */
export type KitPage = {
  /** The page's address, its base path included; its origin is `http://localhost` unless the story names one. */
  readonly url: URL;
  /** The route's params, by name. */
  readonly params: RouteParams;
  /** The route: its id (`/blog/[slug]`), or `null` when no route of the project matches. */
  readonly route: { readonly id: string | null };
  /** The page's HTTP status. */
  readonly status: number;
  /** The error a load or an action gave, or `null`. */
  readonly error: KitError | null;
  /** The page's data: every load's, merged. */
  readonly data: Readonly<Record<string, unknown>>;
  /** The state `pushState` and `replaceState` set (`App.PageState`). */
  readonly state: Readonly<Record<string, unknown>>;
  /** What the last form action returned, or `null`. */
  readonly form: unknown;
};

/** The page a story starts on (`parameters.sveltekit.page`): every field optional. */
export type PageParameters = {
  /** The path (`/blog/hello?tab=1`), from the base path, or an absolute address; `/` by default. */
  readonly url?: string | URL;
  /** The route's params; read from the path by the project's routes when not given. */
  readonly params?: RouteParams;
  /** The route's id, or `{ id }`; read from the path when not given. With params and no `url`, it gives the path. */
  readonly route?: string | { readonly id: string | null };
  /** The HTTP status; 200 by default. */
  readonly status?: number;
  /** The page's error; `null` by default. */
  readonly error?: KitError | null;
  /** The page's data, as its loads would give it (the layouts' among them); `{}` by default. */
  readonly data?: Readonly<Record<string, unknown>>;
  /** The page's state (`App.PageState`); `{}` by default. */
  readonly state?: Readonly<Record<string, unknown>>;
  /** What a form action returned; `null` by default. */
  readonly form?: unknown;
};

/** Where a navigation goes or comes from, as `$app/navigation`'s callbacks receive it. */
export type NavigationTarget = {
  /** The target's params, or `null` for a page outside the app. */
  readonly params: RouteParams | null;
  /** The target's route. */
  readonly route: { readonly id: string | null };
  /** The target's address. */
  readonly url: URL;
};

/** How a navigation started, as SvelteKit names it. */
export type NavigationType = "enter" | "form" | "leave" | "link" | "goto" | "popstate";

/** A navigation, as `beforeNavigate`, `onNavigate`, `afterNavigate` and `navigating` give it. */
export type KitNavigation = {
  /** Where it comes from; `null` for the page's first. */
  readonly from: NavigationTarget | null;
  /** Where it goes. */
  readonly to: NavigationTarget | null;
  /** How it started. */
  readonly type: NavigationType;
  /** Always `false`: a story's navigations stay in its page. */
  readonly willUnload: false;
  /** The steps through the history; only for `popstate`. */
  readonly delta?: number;
  /** Resolves once the navigation is done. */
  readonly complete: Promise<void>;
};

/** What a universal `load` receives (`+page.ts`'s `load`), as the catalogue gives it. */
export type KitLoadEvent = {
  /** The route's params. */
  readonly params: RouteParams;
  /** The page's address. */
  readonly url: URL;
  /** The route. */
  readonly route: { readonly id: string | null };
  /** The page's `fetch`: the frame's own, so the catalogue's mocks answer it. */
  readonly fetch: typeof fetch;
  /** What the page's server load returned (`parameters.sveltekit.serverData`); `null` without one. */
  readonly data: Readonly<Record<string, unknown>> | null;
  /** The data of the layouts above: the page's `data` parameter and the loads before this one, merged. */
  readonly parent: () => Promise<Readonly<Record<string, unknown>>>;
  /** Names what the data depends on, for `invalidate`; recorded, nothing more. */
  readonly depends: (...dependencies: string[]) => void;
  /** Sets the response's headers: there is no response, so nothing. */
  readonly setHeaders: (headers: Readonly<Record<string, string>>) => void;
  /** Runs a function without tracking what it reads: it is run. */
  readonly untrack: <TValue>(read: () => TValue) => TValue;
};

/** A universal `load`, as the catalogue calls it. */
export type KitLoad = (event: KitLoadEvent) => unknown;

/**
 * A universal `load`, as `+page.ts` or `+layout.ts` exports it (`PageLoad`): typed by the project's own `./$types`, so
 * any function is taken, and called with what the catalogue gives (`KitLoadEvent`).
 */
export type StoryLoad = (event: never) => unknown;

/** What a link to an href calls instead of moving the story's page: Storybook's `hrefs` entry. */
export type HrefCallback = (to: string, event: Event) => void;

/** An `hrefs` entry: a callback, or one with whether its key is a regular expression. */
export type HrefParameter = HrefCallback | { readonly callback: HrefCallback; readonly asRegex?: boolean };

/** A function a story gives to hear a call of `$app/navigation`, with the call's own arguments. */
export type NavigationCallback = (...values: never[]) => unknown;

/** What a story hears of `$app/navigation` (`parameters.sveltekit.navigation`), as Storybook's SvelteKit names it. */
export type NavigationParameters = {
  /** Called with `goto`'s arguments. */
  readonly goto?: NavigationCallback;
  /** Called with `invalidate`'s arguments. */
  readonly invalidate?: NavigationCallback;
  /** Called when `invalidateAll` is. */
  readonly invalidateAll?: NavigationCallback;
  /** Called when `refreshAll` is. */
  readonly refreshAll?: NavigationCallback;
  /** Called with `pushState`'s arguments. */
  readonly pushState?: NavigationCallback;
  /** Called with `replaceState`'s arguments. */
  readonly replaceState?: NavigationCallback;
  /** Called with `preloadData`'s arguments. */
  readonly preloadData?: NavigationCallback;
  /** Called with `preloadCode`'s arguments. */
  readonly preloadCode?: NavigationCallback;
  /** What `afterNavigate`'s callbacks get as the page is drawn, over the `enter` navigation the catalogue writes. */
  readonly afterNavigate?: Readonly<Record<string, unknown>>;
};

/** An action's result, as `$app/forms` gives it to `applyAction` and `use:enhance`'s callback. */
export type KitActionResult =
  | { readonly type: "success"; readonly status: number; readonly data?: Readonly<Record<string, unknown>> }
  | { readonly type: "failure"; readonly status: number; readonly data?: Readonly<Record<string, unknown>> }
  | { readonly type: "redirect"; readonly status: number; readonly location: string }
  | { readonly type: "error"; readonly status?: number; readonly error: unknown };

/** What a story's forms do (`parameters.sveltekit.forms`). */
export type FormsParameters = {
  /** Called when a form with `use:enhance` is submitted, as Storybook's SvelteKit calls it. */
  readonly enhance?: () => void;
  /** What the action answers a form with `use:enhance`; `{ type: "success", status: 200 }` by default. */
  readonly result?: KitActionResult;
};

/** A story's SvelteKit settings (`parameters.sveltekit`). */
export type SveltekitParameters = {
  /** The page the story starts on. */
  readonly page?: PageParameters;
  /** What `navigating` holds as the story starts; `null` by default. */
  readonly navigating?: Partial<KitNavigation> | null;
  /** What `updated.current` holds; `false` by default. */
  readonly updated?: boolean;
  /** The page's universal loads, the layouts' first: run in the frame before the story is drawn, and again on `invalidate`. */
  readonly load?: StoryLoad | readonly StoryLoad[];
  /** What the page's server load returned: the `data` the universal load receives, or the page's data without one. */
  readonly serverData?: Readonly<Record<string, unknown>>;
  /** What the story hears of `$app/navigation`. */
  readonly navigation?: NavigationParameters;
  /** What a form with `use:enhance` does. */
  readonly forms?: FormsParameters;
  /** Links whose href is handled by a callback rather than moving the page, by href (or regular expression). */
  readonly hrefs?: Readonly<Record<string, HrefParameter>>;
};

/** A story's SvelteKit settings, read: every field there. */
export type StoryKit = {
  /** The page the story starts on. */
  readonly page: KitPage;
  /** What `navigating` holds as the story starts. */
  readonly navigating: Partial<KitNavigation> | null;
  /** What `updated.current` holds as the story starts. */
  readonly updated: boolean;
  /** The page's universal loads, in order. */
  readonly loads: readonly KitLoad[];
  /** What the page's server load returned, or `null`. */
  readonly serverData: Readonly<Record<string, unknown>> | null;
  /**
   * Whether the story is a page's: it gives its page data (`page.data`, `serverData`, `load`) or an action's answer
   * (`forms.result`), so its component gets `data`, `form` and `params`, as SvelteKit draws a `+page.svelte`.
   */
  readonly isPage: boolean;
  /** What the story hears of `$app/navigation`. */
  readonly navigation: NavigationParameters;
  /** What a form with `use:enhance` does. */
  readonly forms: FormsParameters;
  /** The links handled by a callback. */
  readonly hrefs: Readonly<Record<string, HrefParameter>>;
};

/** The origin a path is given when the story names none: the same in every catalogue, so a page's address is too. */
export const PAGE_ORIGIN = "http://localhost";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A plain object read from a story's parameters, or none.
 *
 * @param value - the value.
 */
const recordOf = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  isRecord(value) ? value : undefined;

/**
 * The params of an object read from a story's parameters: what is not a text left out.
 *
 * @param value - the object.
 */
const paramsOf = (value: unknown): RouteParams | undefined =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).flatMap(([name, item]) =>
          typeof item === "string" || typeof item === "number" ? [[name, String(item)]] : []
        )
      )
    : undefined;

/**
 * Whether a value is a function a story gave.
 *
 * @param value - the value.
 */
const isCallback = (value: unknown): value is NavigationCallback => typeof value === "function";

/**
 * A path made an address: an absolute one as it is, a path after the base path.
 *
 * @param url - the path or the address.
 * @param base - the base path (`/docs`), or empty.
 */
export const pageUrl = (url: string | URL, base: string): URL => {
  if (url instanceof URL) return new URL(url.href);
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) return new URL(url);
  const path = url.startsWith("/") ? url : `/${url}`;
  return new URL(`${base}${path}`, PAGE_ORIGIN);
};

/**
 * A path without the base path, as routes are matched.
 *
 * @param pathname - the address's path.
 * @param base - the base path, or empty.
 */
export const routePath = (pathname: string, base: string): string =>
  base !== "" && (pathname === base || pathname.startsWith(`${base}/`))
    ? pathname.slice(base.length) || "/"
    : pathname;

/**
 * The page a path gives: its route and params from the project's routes.
 *
 * @param url - the page's address.
 * @param routes - the project's page routes.
 * @param base - the base path.
 */
export const routedPage = (
  url: URL,
  routes: readonly string[],
  base: string
): Pick<KitPage, "url" | "params" | "route"> => {
  const match = matchRoute(routes, routePath(url.pathname, base));
  return { url, params: match?.params ?? {}, route: { id: match?.id ?? null } };
};

/**
 * The route id a story's `route` gives.
 *
 * @param route - `page.route`.
 */
const routeIdOf = (route: unknown): string | null | undefined => {
  if (typeof route === "string") return route;
  if (isRecord(route) && (typeof route["id"] === "string" || route["id"] === null)) return route["id"];
  return undefined;
};

/**
 * A page's error read from a story's parameters, or `null`.
 *
 * @param error - `page.error`.
 */
export const errorOf = (error: unknown): KitError | null => {
  if (!isRecord(error) || typeof error["message"] !== "string") return null;
  const { status } = error;
  return { message: error["message"], ...(typeof status === "number" ? { status } : {}) };
};

/**
 * The page a story's page parameters give.
 *
 * @param page - the merged page parameters.
 * @param routes - the project's page routes.
 * @param base - the base path.
 */
const pageOf = (
  page: Readonly<Record<string, unknown>>,
  routes: readonly string[],
  base: string
): KitPage => {
  const params = paramsOf(page["params"]);
  const routeId = routeIdOf(page["route"]);
  const givenUrl = page["url"];
  const hasUrl = typeof givenUrl === "string" || givenUrl instanceof URL;
  const url = hasUrl
    ? pageUrl(givenUrl, base)
    : pageUrl(typeof routeId === "string" ? filledRoute(routeId, params ?? {}) : "/", base);
  const routed = routedPage(url, routes, base);
  const error = page["error"];
  return {
    url,
    params: params ?? routed.params,
    route: { id: routeId === undefined ? routed.route.id : routeId },
    status: typeof page["status"] === "number" ? page["status"] : 200,
    error: errorOf(error),
    data: recordOf(page["data"]) ?? {},
    state: recordOf(page["state"]) ?? {},
    form: page["form"] ?? null
  };
};

/**
 * Storybook's settings, as Forgebook's: `state.page` (or `stores.page`) is the page, its `navigating` and `updated`
 * likewise.
 *
 * @param experimental - `parameters.sveltekit_experimental`.
 */
const fromStorybook = (
  experimental: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> => {
  const state = recordOf(experimental["state"]) ?? recordOf(experimental["stores"]) ?? {};
  const updated = state["updated"];
  return {
    page: state["page"],
    navigating: state["navigating"],
    updated: isRecord(updated) ? updated["current"] : updated,
    navigation: experimental["navigation"],
    forms: experimental["forms"],
    hrefs: experimental["hrefs"]
  };
};

/**
 * The loads a story gives: one, or a list.
 *
 * @param load - `sveltekit.load`.
 */
const loadsOf = (load: unknown): KitLoad[] => {
  if (typeof load === "function")
    return [(event: KitLoadEvent): unknown => Reflect.apply(load, undefined, [event])];
  if (!Array.isArray(load)) return [];
  return load.flatMap((item: unknown) => loadsOf(item));
};

/**
 * The navigation callbacks a story gives.
 *
 * @param navigation - `sveltekit.navigation`.
 */
const navigationOf = (navigation: unknown): NavigationParameters => {
  const read = recordOf(navigation) ?? {};
  const callbacks = Object.fromEntries(
    [
      "goto",
      "invalidate",
      "invalidateAll",
      "refreshAll",
      "pushState",
      "replaceState",
      "preloadData",
      "preloadCode"
    ]
      .map((name) => [name, read[name]] as const)
      .filter((entry): entry is readonly [string, NavigationCallback] => isCallback(entry[1]))
  );
  const after = recordOf(read["afterNavigate"]);
  return after === undefined ? callbacks : { ...callbacks, afterNavigate: after };
};

/**
 * The forms' settings a story gives.
 *
 * @param forms - `sveltekit.forms`.
 */
const formsOf = (forms: unknown): FormsParameters => {
  const read = recordOf(forms) ?? {};
  const { enhance, result } = read;
  return {
    ...(typeof enhance === "function"
      ? { enhance: (): unknown => Reflect.apply(enhance, undefined, []) }
      : {}),
    ...(isRecord(result) && typeof result["type"] === "string" ? { result: actionResultOf(result) } : {})
  };
};

/**
 * An action's result read from a story's parameters.
 *
 * @param result - the value, an object with a `type`.
 */
export const actionResultOf = (result: Readonly<Record<string, unknown>>): KitActionResult => {
  const status = typeof result["status"] === "number" ? result["status"] : undefined;
  const data = recordOf(result["data"]);
  switch (result["type"]) {
    case "failure":
      return { type: "failure", status: status ?? 400, ...(data === undefined ? {} : { data }) };
    case "redirect":
      return { type: "redirect", status: status ?? 303, location: String(result["location"] ?? "/") };
    case "error":
      return { type: "error", ...(status === undefined ? {} : { status }), error: result["error"] };
    default:
      return { type: "success", status: status ?? 200, ...(data === undefined ? {} : { data }) };
  }
};

/**
 * The links a story handles with a callback.
 *
 * @param hrefs - `sveltekit.hrefs`.
 */
const hrefsOf = (hrefs: unknown): Readonly<Record<string, HrefParameter>> =>
  Object.fromEntries(
    Object.entries(recordOf(hrefs) ?? {}).flatMap(([href, entry]): [string, HrefParameter][] => {
      if (typeof entry === "function")
        return [[href, (to: string, event: Event): unknown => entry(to, event)]];
      const callback = isRecord(entry) ? entry["callback"] : undefined;
      if (typeof callback !== "function") return [];
      return [
        [
          href,
          {
            callback: (to: string, event: Event): unknown => Reflect.apply(callback, undefined, [to, event]),
            asRegex: isRecord(entry) && entry["asRegex"] === true
          }
        ]
      ];
    })
  );

/**
 * A story's SvelteKit settings.
 *
 * @param parameters - the story's parameters (the preview's, the meta's and its own, merged).
 * @param routes - the project's page routes, to read a path's route and params.
 * @param base - the base path.
 */
export const storyKitOf = (
  parameters: Readonly<Record<string, unknown>>,
  routes: readonly string[],
  base: string
): StoryKit => {
  const storybook = fromStorybook(recordOf(parameters["sveltekit_experimental"]) ?? {});
  const own = recordOf(parameters["sveltekit"]) ?? {};
  const read = (name: string): unknown => (own[name] === undefined ? storybook[name] : own[name]);
  const page = { ...(recordOf(storybook["page"]) ?? {}), ...(recordOf(own["page"]) ?? {}) };
  const loads = loadsOf(read("load"));
  const serverData = recordOf(read("serverData")) ?? null;
  const navigating = read("navigating");
  const forms = formsOf(read("forms"));
  const readPage = pageOf(page, routes, base);
  return {
    // without a universal load, SvelteKit gives the page its server load's data as it is
    page:
      loads.length === 0 && serverData !== null
        ? { ...readPage, data: { ...readPage.data, ...serverData } }
        : readPage,
    navigating: isRecord(navigating) ? navigating : null,
    updated: read("updated") === true,
    loads,
    serverData,
    isPage:
      page["data"] !== undefined || serverData !== null || loads.length > 0 || forms.result !== undefined,
    navigation: navigationOf(read("navigation")),
    forms,
    hrefs: hrefsOf(read("hrefs"))
  };
};

/**
 * Whether a link's href is handled by an `hrefs` entry, and by which callback.
 *
 * @param hrefs - the story's links handled by a callback.
 * @param href - the link's href, as written.
 */
export const hrefCallbackOf = (
  hrefs: Readonly<Record<string, HrefParameter>>,
  href: string
): HrefCallback | undefined => {
  for (const [key, entry] of Object.entries(hrefs)) {
    const callback = typeof entry === "function" ? entry : entry.callback;
    const asRegex = typeof entry !== "function" && entry.asRegex === true;
    if (asRegex ? new RegExp(key).test(href) : key === href) return callback;
  }
  return undefined;
};
