/**
 * What the fixture's files get without importing it, for the type checker: Nuxt writes this declaration in a project's
 * `.nuxt` folder; the fixture runs no Nuxt, so it is written here, pointing at Forgebook's stand-ins.
 *
 * @module
 */
declare global {
  const defineNuxtConfig: <TConfig>(config: TConfig) => TConfig;
  const defineAppConfig: typeof import("@forgebook/nuxt/app/define")["defineAppConfig"];
  const useRoute: typeof import("@forgebook/nuxt/app/router")["useRoute"];
  const navigateTo: typeof import("@forgebook/nuxt/app/router")["navigateTo"];
  const useAsyncData: typeof import("@forgebook/nuxt/app/data")["useAsyncData"];
  const useFetch: typeof import("@forgebook/nuxt/app/data")["useFetch"];
  const $fetch: typeof import("@forgebook/nuxt/app/data")["$fetch"];
  const useState: typeof import("@forgebook/nuxt/app/state")["useState"];
  const useCookie: typeof import("@forgebook/nuxt/app/state")["useCookie"];
  const useRuntimeConfig: typeof import("@forgebook/nuxt/app/state")["useRuntimeConfig"];
  const useAppConfig: typeof import("@forgebook/nuxt/app/state")["useAppConfig"];
  const computed: typeof import("vue")["computed"];
  const useGreeting: typeof import("./app/composables/useGreeting")["useGreeting"];
  const titleOfSlug: typeof import("./app/utils/slug")["titleOfSlug"];
  const formatPrice: typeof import("./shared/utils/money")["formatPrice"];
}

declare module "vue" {
  interface GlobalComponents {
    // biome-ignore lint/style/useNamingConvention: Vue names a component in PascalCase
    NuxtLink: typeof import("@forgebook/nuxt/app/components")["NuxtLink"];
    // biome-ignore lint/style/useNamingConvention: Vue names a component in PascalCase
    BaseBadge: typeof import("./app/components/base/Badge.vue")["default"];
  }
  interface ComponentCustomProperties {
    titleOfSlug: typeof import("./app/utils/slug")["titleOfSlug"];
    formatPrice: typeof import("./shared/utils/money")["formatPrice"];
  }
}

export {};
