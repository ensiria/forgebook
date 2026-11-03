/**
 * `next/navigation` in a catalogue: the App Router's hooks read the story's route (`parameters.nextjs.navigation`),
 * its router moves it, and `redirect` and `notFound` say in the story's place what Next.js would have done.
 *
 * @remarks
 * The Vite plugin resolves `next/navigation` to this module, for the project's code and its dependencies alike. It is
 * Forgebook's own, not Next.js's with its internals provided: those internals change between Next.js versions, and
 * this keeps every hook a story can call working on each of them. Every export of `next/navigation` a component can
 * import is here; the ones only a server render uses (`useServerInsertedHTML`) do nothing.
 *
 * @module
 */
import { useSyncExternalStore } from "react";

import type { StoryRoute } from "../route.ts";
import { currentStore, type RouteStore } from "../routeStore.ts";
import type { RouteValues } from "../stories.ts";

/** The search params `useSearchParams` returns: read-only, as Next.js's are. */
export class ReadonlyURLSearchParams extends URLSearchParams {
  /** Refused: the search params of a route are read-only. */
  override append(..._values: readonly unknown[]): never {
    throw new ReadonlyURLSearchParamsError();
  }
  /** Refused: the search params of a route are read-only. */
  override delete(..._values: readonly unknown[]): never {
    throw new ReadonlyURLSearchParamsError();
  }
  /** Refused: the search params of a route are read-only. */
  override set(..._values: readonly unknown[]): never {
    throw new ReadonlyURLSearchParamsError();
  }
  /** Refused: the search params of a route are read-only. */
  override sort(..._values: readonly unknown[]): never {
    throw new ReadonlyURLSearchParamsError();
  }
}

/** What changing a route's search params throws, with Next.js's own message. */
class ReadonlyURLSearchParamsError extends Error {
  /** The error. */
  constructor() {
    super(
      "Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams"
    );
  }
}

/** How a redirect goes: as a new entry of the history, or in place of the current one. */
export const RedirectType = { push: "push", replace: "replace" } as const;

/** What a navigation function throws in a story: the function and where it would have gone. */
export class NextNavigationError extends Error {
  /** The function the story called (`redirect`). */
  readonly method: string;
  /**
   * The error.
   *
   * @param method - the function the story called.
   * @param message - what Next.js would have done instead of drawing the story.
   */
  constructor(method: string, message: string) {
    super(message);
    this.name = "NextNavigationError";
    this.method = method;
  }
}

/** The App Router's router, as `useRouter` returns it. */
export type AppRouterInstance = {
  /** Goes to an href, as a new entry of the history. */
  readonly push: (href: string, options?: { readonly scroll?: boolean }) => void;
  /** Goes to an href, in place of the current entry. */
  readonly replace: (href: string, options?: { readonly scroll?: boolean }) => void;
  /** Goes back. */
  readonly back: () => void;
  /** Goes forward. */
  readonly forward: () => void;
  /** Refreshes the route: recorded only. */
  readonly refresh: () => void;
  /** Prefetches a route: recorded only. */
  readonly prefetch: (href: string) => void;
};

/**
 * The store of the story drawn now, and its route, kept in step with it.
 *
 * @returns the route.
 */
const useRoute = (): StoryRoute => {
  const store = currentStore();
  return useSyncExternalStore(store.subscribe, store.route, store.route);
};

/** Routers by store, so a component gets the same router on every render, as with Next.js. */
const routers = new WeakMap<RouteStore, AppRouterInstance>();

/**
 * The App Router's router over a store.
 *
 * @param store - the story's store.
 */
const appRouterOf = (store: RouteStore): AppRouterInstance => {
  const known = routers.get(store);
  if (known !== undefined) return known;
  const router: AppRouterInstance = {
    push: (href: string): void => {
      store.navigate("push", href);
    },
    replace: (href: string): void => {
      store.navigate("replace", href);
    },
    back: (): void => store.go(-1),
    forward: (): void => store.go(1),
    refresh: (): void => store.record("router.refresh", []),
    prefetch: (href: string): void => store.record("router.prefetch", [href])
  };
  routers.set(store, router);
  return router;
};

/** The story's path (`/blog/hello`). */
export const usePathname = (): string => useRoute().pathname;

/** The search params of each route, so a component gets the same object until the route changes, as with Next.js. */
const searchParams = new WeakMap<StoryRoute, ReadonlyURLSearchParams>();

/** The story's search params, read-only. */
export const useSearchParams = (): ReadonlyURLSearchParams => {
  const route = useRoute();
  const known = searchParams.get(route);
  if (known !== undefined) return known;
  const params = new ReadonlyURLSearchParams(route.search);
  searchParams.set(route, params);
  return params;
};

/** The story's dynamic segments (`{ slug: "hello" }`). */
export const useParams = (): RouteValues => useRoute().params;

/** The router: its calls move the story's route and are listed among its events. */
export const useRouter = (): AppRouterInstance => {
  useRoute();
  return appRouterOf(currentStore());
};

/** The segments below the layout (`parameters.nextjs.navigation.segments`). */
export const useSelectedLayoutSegments = (): string[] => [...useRoute().segments];

/** The first segment below the layout, or `null`. */
export const useSelectedLayoutSegment = (): string | null => useRoute().segments[0] ?? null;

/** Inserts HTML in a server render's stream: a story is drawn in the browser, so there is none. */
export const useServerInsertedHTML = (): void => undefined;

/**
 * Throws what stops a story where Next.js would have gone elsewhere, after listing the call.
 *
 * @param method - the function.
 * @param values - what it was called with.
 * @param message - what Next.js would have done.
 */
const stop = (method: string, values: readonly unknown[], message: string): never => {
  currentStore().record(`navigation.${method}`, values);
  throw new NextNavigationError(method, message);
};

/**
 * Stops the story: in the app, Next.js would go to the href instead.
 *
 * @param href - where it would go.
 */
export const redirect = (href: string): never =>
  stop(
    "redirect",
    [href],
    `redirect("${href}"): in the app, Next.js would go to ${href} instead of drawing this`
  );

/**
 * Stops the story: in the app, Next.js would go to the href for good (a 308) instead.
 *
 * @param href - where it would go.
 */
export const permanentRedirect = (href: string): never =>
  stop(
    "permanentRedirect",
    [href],
    `permanentRedirect("${href}"): in the app, Next.js would go to ${href} instead of drawing this`
  );

/** Stops the story: in the app, Next.js would draw the route's not-found page instead. */
export const notFound = (): never =>
  stop("notFound", [], "notFound(): in the app, Next.js would draw the not-found page instead of this");

/** Stops the story: in the app, Next.js would draw the forbidden page (a 403) instead. */
export const forbidden = (): never =>
  stop("forbidden", [], "forbidden(): in the app, Next.js would draw the forbidden page instead of this");

/** Stops the story: in the app, Next.js would draw the unauthorized page (a 401) instead. */
export const unauthorized = (): never =>
  stop(
    "unauthorized",
    [],
    "unauthorized(): in the app, Next.js would draw the unauthorized page instead of this"
  );

/**
 * Throws again an error that is one of Next.js's own (a redirect, a not-found), so a `catch` does not swallow it.
 *
 * @param error - the error caught.
 */
export const unstable_rethrow = (error: unknown): void => {
  if (error instanceof NextNavigationError) throw error;
};

/** Whether an error is a server action Next.js did not recognise: a story calls none through Next.js. */
export const unstable_isUnrecognizedActionError = (): boolean => false;
