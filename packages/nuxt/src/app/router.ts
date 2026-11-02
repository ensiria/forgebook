/**
 * Nuxt's router composables in a catalogue: `useRoute` and `useRouter` are vue-router's own, on the story's router;
 * `navigateTo` moves it, and records where an external or new-window navigation would have gone instead of leaving the
 * story's frame.
 *
 * @remarks
 * What Nuxt does with a page (its meta, its layout, its middleware, preloading its code) has no page to act on in a
 * story, so those functions take their arguments and do nothing, and a story's component is drawn as it is.
 *
 * Internal: the code the plugin writes imports it (`#imports`, `#app`, `#components`); a story or a component imports
 * Nuxt's names as in the app, never this module, whose exports may change in any release.
 *
 * @module
 */
import { hasInjectionContext } from "vue";
import type { RouteLocationNormalizedLoaded, RouteLocationRaw, Router } from "vue-router";
import { useRoute as useVueRoute } from "vue-router";

import { useNuxtStore } from "../nuxtStore.ts";

/** What `navigateTo` takes besides where to go. */
export type NavigateToOptions = {
  /** Whether it replaces the history's entry instead of adding one. */
  readonly replace?: boolean;
  /** The HTTP status of a redirect on the server: no effect in a story. */
  readonly redirectCode?: number;
  /** Whether the location is outside the app, which Nuxt requires for another origin. */
  readonly external?: boolean;
  /** Opens the location in a new window, as `window.open` would, with its target and features. */
  readonly open?: { readonly target?: string; readonly windowFeatures?: Readonly<Record<string, unknown>> };
};

/** Whether an address names another origin, or a protocol other than the web's. */
const isExternal = (to: RouteLocationRaw): boolean =>
  typeof to === "string" && (/^[a-z][a-z\d+.-]*:/i.test(to) || to.startsWith("//"));

/**
 * The story's route, which follows its router: vue-router's `useRoute` in a component's setup, the router's current
 * route elsewhere, as Nuxt's falls back to its app's.
 */
export const useRoute = (): RouteLocationNormalizedLoaded =>
  hasInjectionContext() ? useVueRoute() : useNuxtStore().router.currentRoute.value;

/** The story's router: vue-router's own, its moves recorded. */
export const useRouter = (): Router => useNuxtStore().router;

/**
 * Goes somewhere, as Nuxt's `navigateTo`: inside the app the story's router moves; another origin, or a new window, is
 * recorded and left alone, so the story's frame stays where it is.
 *
 * @param to - where to go: a path, or a location.
 * @param options - whether it replaces, whether it is external, whether it opens a window.
 * @returns what the router's move returns; nothing for a navigation the story does not make.
 * @throws a navigation to another origin without `external: true`, as Nuxt throws it.
 */
export const navigateTo = async (
  to: RouteLocationRaw | undefined | null,
  options: NavigateToOptions = {}
): Promise<unknown> => {
  const store = useNuxtStore();
  const target = to ?? "/";
  const path = typeof target === "string" ? target : store.router.resolve(target).fullPath;
  const flags = {
    ...(options.replace === true ? { replace: true } : {}),
    ...(options.external === true ? { external: true } : {}),
    ...(options.open === undefined ? {} : { open: true })
  };
  store.record("navigateTo", Object.keys(flags).length === 0 ? [path] : [path, flags]);
  // a new window, or a navigation that leaves the app (a full page load), would leave the story's frame
  if (options.open !== undefined || options.external === true) return undefined;
  if (isExternal(target))
    throw new Error(
      "Navigating to an external URL is not allowed by default. Use `navigateTo(url, { external: true })`."
    );
  return store.move(target, options.replace === true);
};

/**
 * Stops a navigation from a route middleware: there is none in a story, so it returns `false`, as a middleware's
 * `return false` does.
 */
export const abortNavigation = (): false => false;

/**
 * A route middleware, as Nuxt defines one: the function itself, since a story runs no middleware.
 *
 * @param middleware - the middleware.
 */
export const defineNuxtRouteMiddleware = <TMiddleware>(middleware: TMiddleware): TMiddleware => middleware;

/** Adds a route middleware: none runs in a story, so it does nothing. */
export const addRouteMiddleware = (): void => undefined;

/** A page's meta: read by Nuxt when it builds its routes, never at run time, so it does nothing in a story. */
export const definePageMeta = (): void => undefined;

/**
 * A route's rules, as Nuxt 4 reads them at build time: nothing at run time.
 */
export const defineRouteRules = (): void => undefined;

/**
 * Sets the page's layout: a story has no layout, so the call is recorded.
 *
 * @param layout - the layout's name.
 */
export const setPageLayout = (layout: string): void => {
  useNuxtStore().record("setPageLayout", [layout]);
};

/** Preloads a route's components: there is nothing to load in a story. */
export const preloadRouteComponents = async (): Promise<void> => undefined;

/** Preloads components by name: they load when a story draws them. */
export const preloadComponents = async (): Promise<void> => undefined;

/** Prefetches components by name: they load when a story draws them. */
export const prefetchComponents = async (): Promise<void> => undefined;

/**
 * Reloads the app: recorded, since reloading the frame would start the story over.
 *
 * @param options - Nuxt's options (`path`, `force`, `persistState`).
 */
export const reloadNuxtApp = (options: Readonly<Record<string, unknown>> = {}): void => {
  useNuxtStore().record("reloadNuxtApp", [options]);
};
