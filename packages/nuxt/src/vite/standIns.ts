/**
 * What a Nuxt project's code gets without importing it, and from where: Nuxt's composables and helpers from this
 * package's stand-ins (`@forgebook/nuxt/app/…`), Vue's API, and the vue-router functions Nuxt imports for a project.
 *
 * @remarks
 * The table is what `#app` exports, and with the project's own composables what `#imports` exports and what the plugin
 * imports into a file that uses a name without importing it, as Nuxt does. A Nuxt function not in it is not given: a
 * file that uses one fails on it by name, which says what a story lacks.
 *
 * @module
 */

/** A name a file gets without importing it, and the module that has it. */
export type StandIn = {
  /** The name. */
  readonly name: string;
  /** The module (`@forgebook/nuxt/app/router`). */
  readonly from: string;
};

/** This package's stand-ins, by module: the names each exports. */
const STAND_INS: Readonly<Record<string, readonly string[]>> = {
  "@forgebook/nuxt/app/router": [
    "useRoute",
    "useRouter",
    "navigateTo",
    "abortNavigation",
    "defineNuxtRouteMiddleware",
    "addRouteMiddleware",
    "definePageMeta",
    "defineRouteRules",
    "setPageLayout",
    "preloadRouteComponents",
    "preloadComponents",
    "prefetchComponents",
    "reloadNuxtApp"
  ],
  "@forgebook/nuxt/app/data": [
    "useAsyncData",
    "useLazyAsyncData",
    "refreshNuxtData",
    "clearNuxtData",
    "useNuxtData"
  ],
  "@forgebook/nuxt/app/fetch": ["useFetch", "useLazyFetch", "$fetch"],
  "@forgebook/nuxt/app/state": [
    "useState",
    "clearNuxtState",
    "useCookie",
    "refreshCookie",
    "useRuntimeConfig",
    "useAppConfig",
    "updateAppConfig",
    "useNuxtApp",
    "tryUseNuxtApp",
    "callOnce",
    "onNuxtReady",
    "useRequestHeaders",
    "useRequestHeader",
    "useRequestEvent",
    "useRequestFetch",
    "useRequestURL",
    "isPrerendered",
    "useLoadingIndicator"
  ],
  "@forgebook/nuxt/app/errors": ["createError", "isNuxtError", "useError", "showError", "clearError"],
  "@forgebook/nuxt/app/head": [
    "useHead",
    "useHeadSafe",
    "useSeoMeta",
    "useServerHead",
    "useServerHeadSafe",
    "useServerSeoMeta"
  ],
  "@forgebook/nuxt/app/define": [
    "defineNuxtComponent",
    "defineNuxtPlugin",
    "definePayloadPlugin",
    "defineAppConfig"
  ]
};

/** The vue-router functions Nuxt auto-imports besides its own `useRoute` and `useRouter`. */
const ROUTER_IMPORTS = ["onBeforeRouteLeave", "onBeforeRouteUpdate", "useLink"] as const;

/** Nuxt's names, from this package's stand-ins: what `#app` exports. */
export const NUXT_STAND_INS: readonly StandIn[] = Object.entries(STAND_INS).flatMap(([from, names]) =>
  names.map((name) => ({ name, from }))
);

/** The vue-router functions a project's code gets without importing them. */
export const ROUTER_STAND_INS: readonly StandIn[] = ROUTER_IMPORTS.map((name) => ({
  name,
  from: "vue-router"
}));

/** The module of Nuxt's built-in components. */
export const COMPONENTS_MODULE = "@forgebook/nuxt/app/components";

/** Nuxt's built-in components, by name: what a template finds without importing them. */
export const BUILT_IN_COMPONENT_NAMES = [
  "NuxtLink",
  "ClientOnly",
  "DevOnly",
  "NuxtLayout",
  "NuxtErrorBoundary",
  "NuxtPage",
  "NuxtLoadingIndicator",
  "NuxtRouteAnnouncer",
  "NuxtImg",
  "NuxtPicture"
] as const;
