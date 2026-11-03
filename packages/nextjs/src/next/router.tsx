/**
 * `next/router` in a catalogue: the Pages Router's `useRouter`, `withRouter` and default `Router` read the story's
 * route (`parameters.nextjs.router`), and their `push`, `replace`, `back` and `forward` move it.
 *
 * @remarks
 * The same route the App Router's hooks read (`next/navigation`), so a component of either router works in any story.
 * `router.events` emits `routeChangeStart` and `routeChangeComplete` around each move, as Next.js does; `beforePopState`
 * and `prefetch` are recorded only. Forgebook's own module, not Next.js's with its internals provided, for the reason
 * `navigation.ts` gives.
 *
 * @module
 */
import { type ComponentType, type ReactNode, useSyncExternalStore } from "react";

import { appSettings } from "../appSettings.ts";
import { type Href, hrefOfRoute, hrefText, pagesQueryOf, routeAfterAs, type StoryRoute } from "../route.ts";
import { currentStore, type RouteStore } from "../routeStore.ts";
import type { RouteValues } from "../stories.ts";

/** A router event's handler: the path, and whether the move was shallow. */
type RouterEventHandler = (url: string, options: { readonly shallow: boolean }) => void;

/** The events the Pages Router emits. */
export type RouterEvent =
  | "routeChangeStart"
  | "beforeHistoryChange"
  | "routeChangeComplete"
  | "routeChangeError"
  | "hashChangeStart"
  | "hashChangeComplete";

/** The Pages Router's events: `on`, `off` and `emit`, as Next.js's `mitt` has them. */
export type RouterEvents = {
  /** Listens to an event. */
  readonly on: (event: RouterEvent, handler: RouterEventHandler) => void;
  /** Stops listening. */
  readonly off: (event: RouterEvent, handler: RouterEventHandler) => void;
  /** Emits an event. */
  readonly emit: (event: RouterEvent, url: string, options: { readonly shallow: boolean }) => void;
};

/** The options of `push` and `replace`. */
type TransitionOptions = {
  readonly shallow?: boolean;
  readonly scroll?: boolean;
  readonly locale?: string | false;
};

/** The Pages Router, as `useRouter` returns it. */
export type NextRouter = {
  /** The page's route (`/blog/[slug]`). */
  readonly route: string;
  /** The page's route, as Next.js names it there too. */
  readonly pathname: string;
  /** The route's params and the search params. */
  readonly query: RouteValues;
  /** The path as the browser shows it. */
  readonly asPath: string;
  /** The app's base path. */
  readonly basePath: string;
  /** The locale, with internationalised routing. */
  readonly locale: string | undefined;
  /** The locales. */
  readonly locales: readonly string[] | undefined;
  /** The default locale. */
  readonly defaultLocale: string | undefined;
  /** Whether the route is a fallback page being generated. */
  readonly isFallback: boolean;
  /** Whether the router has its query: always. */
  readonly isReady: boolean;
  /** Whether the page is in preview mode. */
  readonly isPreview: boolean;
  /** Whether the locale comes from a domain: never in a story. */
  readonly isLocaleDomain: boolean;
  /** Goes to an href, as a new entry of the history. */
  readonly push: (url: Href, as?: Href, options?: TransitionOptions) => Promise<boolean>;
  /** Goes to an href, in place of the current entry. */
  readonly replace: (url: Href, as?: Href, options?: TransitionOptions) => Promise<boolean>;
  /** Reloads the page: recorded only. */
  readonly reload: () => void;
  /** Goes back. */
  readonly back: () => void;
  /** Goes forward. */
  readonly forward: () => void;
  /** Prefetches a page: recorded only. */
  readonly prefetch: (url: string) => Promise<void>;
  /** Handles the browser's back button before the router does: recorded only. */
  readonly beforePopState: (handler: () => boolean) => void;
  /** The router's events. */
  readonly events: RouterEvents;
};

/** The events' handlers, shared by every router of the frame as Next.js's singleton shares them. */
const handlers = new Map<RouterEvent, Set<RouterEventHandler>>();

/** The Pages Router's events. */
const events: RouterEvents = {
  on: (event: RouterEvent, handler: RouterEventHandler): void => {
    const known = handlers.get(event) ?? new Set<RouterEventHandler>();
    known.add(handler);
    handlers.set(event, known);
  },
  off: (event: RouterEvent, handler: RouterEventHandler): void => {
    handlers.get(event)?.delete(handler);
  },
  emit: (event: RouterEvent, url: string, options: { readonly shallow: boolean }): void => {
    for (const handler of handlers.get(event) ?? []) handler(url, options);
  }
};

/**
 * Moves the store's route as `push` or `replace` does, around the events Next.js emits.
 *
 * @param store - the story's store.
 * @param method - `push` or `replace`.
 * @param url - where to go: a path or a route.
 * @param as - the path the browser shows, when `url` names a route.
 * @param options - the move's options.
 * @returns whether the route moved.
 */
const move = async (
  store: RouteStore,
  method: "push" | "replace",
  url: Href,
  as: Href | undefined,
  options: TransitionOptions | undefined
): Promise<boolean> => {
  const shallow = { shallow: options?.shallow === true };
  const path = `${appSettings().basePath}${hrefText(as ?? url).text}`;
  const from = store.route();
  const to = routeAfterAs(from, url, as);
  // a move within the page (its hash only) is a hash change, as Next.js names it
  const isHashOnly =
    to !== undefined && to.pathname === from.pathname && to.search === from.search && to.hash !== from.hash;
  events.emit(isHashOnly ? "hashChangeStart" : "routeChangeStart", path, shallow);
  const isMoved = store.navigate(method, url, as);
  if (isMoved) events.emit(isHashOnly ? "hashChangeComplete" : "routeChangeComplete", path, shallow);
  return isMoved;
};

/**
 * The Pages Router over a store, at a route.
 *
 * @param store - the story's store.
 * @param route - the route it is at.
 */
const pagesRouter = (store: RouteStore, route: StoryRoute): NextRouter => ({
  route: route.route,
  pathname: route.route,
  query: pagesQueryOf(route),
  asPath: hrefOfRoute(route),
  basePath: appSettings().basePath,
  locale: store.settings.locale,
  locales: store.settings.locales,
  defaultLocale: store.settings.defaultLocale,
  isFallback: store.settings.isFallback,
  isReady: true,
  isPreview: store.settings.isPreview,
  isLocaleDomain: false,
  push: (url: Href, as?: Href, options?: TransitionOptions): Promise<boolean> =>
    move(store, "push", url, as, options),
  replace: (url: Href, as?: Href, options?: TransitionOptions): Promise<boolean> =>
    move(store, "replace", url, as, options),
  reload: (): void => store.record("router.reload", []),
  back: (): void => store.go(-1),
  forward: (): void => store.go(1),
  prefetch: async (url: string): Promise<void> => {
    store.record("router.prefetch", [url]);
  },
  beforePopState: (): void => store.record("router.beforePopState", []),
  events
});

/** Routers by route, so a component gets the same router until the route changes. */
const routers = new WeakMap<StoryRoute, NextRouter>();

/**
 * The router of the story drawn now, at its route.
 *
 * @param store - the story's store.
 * @param route - its route now.
 */
const routerAt = (store: RouteStore, route: StoryRoute): NextRouter => {
  const known = routers.get(route);
  if (known !== undefined) return known;
  const router = pagesRouter(store, route);
  routers.set(route, router);
  return router;
};

/** The Pages Router, drawn again when the story's route moves. */
export const useRouter = (): NextRouter => {
  const store = currentStore();
  const route = useSyncExternalStore(store.subscribe, store.route, store.route);
  return routerAt(store, route);
};

/**
 * A component given the router as its `router` prop.
 *
 * @param Component - the component.
 * @returns the component, the router given.
 */
export const withRouter = <TProps extends object>(
  Component: ComponentType<TProps & { readonly router: NextRouter }>
): ComponentType<TProps> => {
  const WithRouter = (props: TProps): ReactNode => <Component {...props} router={useRouter()} />;
  return WithRouter;
};

/**
 * The router outside React (`import Router from "next/router"`): every read is the story's router now, so a module
 * that keeps it reads the route as it moves.
 */
const Router: NextRouter = {
  get route(): string {
    return currentRouter().route;
  },
  get pathname(): string {
    return currentRouter().pathname;
  },
  get query(): RouteValues {
    return currentRouter().query;
  },
  get asPath(): string {
    return currentRouter().asPath;
  },
  get basePath(): string {
    return currentRouter().basePath;
  },
  get locale(): string | undefined {
    return currentRouter().locale;
  },
  get locales(): readonly string[] | undefined {
    return currentRouter().locales;
  },
  get defaultLocale(): string | undefined {
    return currentRouter().defaultLocale;
  },
  get isFallback(): boolean {
    return currentRouter().isFallback;
  },
  isReady: true,
  get isPreview(): boolean {
    return currentRouter().isPreview;
  },
  isLocaleDomain: false,
  push: (url: Href, as?: Href, options?: TransitionOptions): Promise<boolean> =>
    currentRouter().push(url, as, options),
  replace: (url: Href, as?: Href, options?: TransitionOptions): Promise<boolean> =>
    currentRouter().replace(url, as, options),
  reload: (): void => currentRouter().reload(),
  back: (): void => currentRouter().back(),
  forward: (): void => currentRouter().forward(),
  prefetch: (url: string): Promise<void> => currentRouter().prefetch(url),
  beforePopState: (handler: () => boolean): void => currentRouter().beforePopState(handler),
  events
};

/** The router of the story drawn now. */
const currentRouter = (): NextRouter => {
  const store = currentStore();
  return routerAt(store, store.route());
};

export default Router;
