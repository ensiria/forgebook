/**
 * Nuxt's built-in components in a catalogue: `NuxtLink` on vue-router's `RouterLink`, `ClientOnly`, `DevOnly`,
 * `NuxtLayout`, `NuxtErrorBoundary`, and those with nothing to draw in a story (`NuxtPage`, `NuxtLoadingIndicator`,
 * `NuxtRouteAnnouncer`). `NuxtImg` and `NuxtPicture`, which `@nuxt/image` adds, draw the image as it is, since there is
 * no image server.
 *
 * @remarks
 * A link inside the app moves the story's router, as Nuxt's does. A link outside it (another origin, `external`, a
 * target other than `_self`) is drawn as Nuxt draws it, and its click is recorded instead of followed, so the story's
 * frame stays where it is.
 *
 * @module
 */
import {
  type Component,
  defineComponent,
  h,
  onErrorCaptured,
  onMounted,
  ref,
  type SetupContext,
  type VNode
} from "vue";
import { type RouteLocationRaw, RouterLink, type RouterLinkProps } from "vue-router";

import { useNuxtStore } from "../nuxtStore.ts";

/** What `NuxtLink` takes. */
export type NuxtLinkProps = {
  /** Where it goes: a path, a location, or an address outside the app. */
  readonly to?: RouteLocationRaw;
  /** `to`'s other name. */
  readonly href?: RouteLocationRaw;
  /** Whether the address is outside the app. */
  readonly external?: boolean;
  /** The anchor's target. */
  readonly target?: string;
  /** The anchor's `rel`; `noopener noreferrer` for an external link by default. */
  readonly rel?: string;
  /** Whether an external link gets no `rel`. */
  readonly noRel?: boolean;
  /** Whether it replaces the history's entry. */
  readonly replace?: boolean;
  /** The class of a link to the current route or one of its parents. */
  readonly activeClass?: string;
  /** The class of a link to the current route. */
  readonly exactActiveClass?: string;
  /** The `aria-current` of a link to the current route. */
  readonly ariaCurrentValue?: "page" | "step" | "location" | "date" | "time" | "true" | "false";
  /** Whether the default slot draws the link itself. */
  readonly custom?: boolean;
  /** Whether it prefetches: no effect in a story. */
  readonly prefetch?: boolean;
  /** Whether it does not prefetch: no effect in a story. */
  readonly noPrefetch?: boolean;
};

/** Whether an address is outside the app: another origin, or a protocol other than the web's. */
const isExternalAddress = (to: RouteLocationRaw): boolean =>
  typeof to === "string" && (/^[a-z][a-z\d+.-]*:/i.test(to) || to.startsWith("//"));

/**
 * Whether a link goes outside the app: `external`, another origin, or a target other than `_self`.
 *
 * @param props - the link's props.
 * @param to - where it goes.
 */
const isLinkExternal = (props: NuxtLinkProps, to: RouteLocationRaw): boolean =>
  props.external === true ||
  isExternalAddress(to) ||
  (props.target !== undefined && props.target !== "_self");

/**
 * The props `RouterLink` gets from `NuxtLink`'s.
 *
 * @param props - the link's props.
 * @param to - where it goes.
 */
const routerLinkProps = (props: NuxtLinkProps, to: RouteLocationRaw): RouterLinkProps => ({
  to,
  replace: props.replace === true,
  custom: props.custom === true,
  ...(props.activeClass === undefined ? {} : { activeClass: props.activeClass }),
  ...(props.exactActiveClass === undefined ? {} : { exactActiveClass: props.exactActiveClass }),
  ...(props.ariaCurrentValue === undefined ? {} : { ariaCurrentValue: props.ariaCurrentValue })
});

/**
 * A link outside the app, drawn as Nuxt draws it, its click recorded instead of followed.
 *
 * @param props - the link's props.
 * @param href - where it goes.
 * @param slots - its slots.
 * @param record - records a call.
 */
const externalLink = (
  props: NuxtLinkProps,
  href: string,
  slots: SetupContext["slots"],
  record: (name: string, values: readonly unknown[]) => void
): VNode => {
  const rel = props.noRel === true ? undefined : (props.rel ?? "noopener noreferrer");
  const navigate = (event?: MouseEvent): void => {
    event?.preventDefault();
    record("navigateTo", [href, { external: true }]);
  };
  if (props.custom === true)
    return h(
      "span",
      { style: "display: contents" },
      slots["default"]?.({ href, navigate, rel, target: props.target, isExternal: true, isActive: false })
    );
  return h("a", { href, rel, target: props.target, onClick: navigate }, slots["default"]?.());
};

/** A link, inside the app or outside it, as Nuxt's `NuxtLink`. */
export const NuxtLink = defineComponent(
  (props: NuxtLinkProps, { slots }: SetupContext) => {
    const store = useNuxtStore();
    return (): VNode => {
      const to = props.to ?? props.href ?? "";
      if (!isLinkExternal(props, to)) return h(RouterLink, routerLinkProps(props, to), slots);
      const href = typeof to === "string" ? to : store.router.resolve(to).href;
      return externalLink(props, href, slots, store.record);
    };
  },
  {
    name: "NuxtLink",
    props: [
      "to",
      "href",
      "external",
      "target",
      "rel",
      "noRel",
      "replace",
      "activeClass",
      "exactActiveClass",
      "ariaCurrentValue",
      "custom",
      "prefetch",
      "noPrefetch"
    ]
  }
);

/** What `ClientOnly` takes. */
export type ClientOnlyProps = {
  /** The text drawn before it is mounted. */
  readonly fallback?: string;
  /** The element the fallback text is drawn in; `span` by default. */
  readonly fallbackTag?: string;
  /** `fallback`'s other name. */
  readonly placeholder?: string;
  /** `fallbackTag`'s other name. */
  readonly placeholderTag?: string;
};

/** Draws its content once mounted in the page, and its fallback before (on the server), as Nuxt's. */
export const ClientOnly = defineComponent(
  (props: ClientOnlyProps, { slots }: SetupContext) => {
    const isMounted = ref(false);
    onMounted(() => {
      isMounted.value = true;
    });
    return (): VNode[] | VNode | null => {
      if (isMounted.value) return slots["default"]?.() ?? null;
      const fallback = slots["fallback"] ?? slots["placeholder"];
      if (fallback !== undefined) return fallback();
      const text = props.fallback ?? props.placeholder;
      return text === undefined ? null : h(props.fallbackTag ?? props.placeholderTag ?? "span", text);
    };
  },
  { name: "ClientOnly", props: ["fallback", "fallbackTag", "placeholder", "placeholderTag"] }
);

/** Draws its content in development, which a catalogue is. */
export const DevOnly = defineComponent(
  (_props: Record<string, never>, { slots }: SetupContext) =>
    (): VNode[] | null =>
      slots["default"]?.() ?? null,
  { name: "DevOnly" }
);

/** A layout: a story has none, so its content is drawn as it is. */
export const NuxtLayout = defineComponent(
  (_props: { readonly name?: string; readonly fallback?: string }, { slots }: SetupContext) =>
    (): VNode[] | null =>
      slots["default"]?.() ?? null,
  { name: "NuxtLayout", props: ["name", "fallback"] }
);

/** Catches what its content throws, and draws its `error` slot instead, with what clears it. */
export const NuxtErrorBoundary = defineComponent(
  (_props: Record<string, never>, { slots, emit }: SetupContext<["error"]>) => {
    const error = ref<unknown>(null);
    onErrorCaptured((caught: unknown) => {
      error.value = caught;
      emit("error", caught);
      return false;
    });
    const clearError = (): void => {
      error.value = null;
    };
    return (): VNode[] | null =>
      (error.value === null ? slots["default"]?.() : slots["error"]?.({ error, clearError })) ?? null;
  },
  { name: "NuxtErrorBoundary", emits: ["error"] }
);

/**
 * A component with nothing to draw in a story.
 *
 * @param name - its name.
 */
const nothing = (name: string): Component => defineComponent(() => (): null => null, { name, props: [] });

/** The page of the route: a story draws its own component, not a page. */
export const NuxtPage = nothing("NuxtPage");

/** The bar shown while a page loads: none loads in a story. */
export const NuxtLoadingIndicator = nothing("NuxtLoadingIndicator");

/** What tells a screen reader the page changed: no page changes in a story. */
export const NuxtRouteAnnouncer = nothing("NuxtRouteAnnouncer");

/** What `NuxtImg` takes: the image's attributes. */
export type NuxtImgProps = {
  /** The image's address. */
  readonly src?: string;
  /** Its text alternative. */
  readonly alt?: string;
  /** Its width. */
  readonly width?: string | number;
  /** Its height. */
  readonly height?: string | number;
  /** How it loads. */
  readonly loading?: "lazy" | "eager";
  /** Its sizes. */
  readonly sizes?: string;
};

/**
 * The image's attributes, as `NuxtImg` gives them: what has no value left out.
 *
 * @param props - the props.
 */
const imageAttributes = (props: NuxtImgProps): Record<string, unknown> =>
  Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined));

/** `@nuxt/image`'s image, drawn as it is: there is no image server to resize it. */
export const NuxtImg = defineComponent(
  (props: NuxtImgProps) => (): VNode => h("img", imageAttributes(props)),
  {
    name: "NuxtImg",
    props: ["src", "alt", "width", "height", "loading", "sizes"]
  }
);

/** `@nuxt/image`'s picture, drawn as one image: there is no image server to give the other formats. */
export const NuxtPicture = defineComponent(
  (props: NuxtImgProps) => (): VNode => h("picture", [h("img", imageAttributes(props))]),
  { name: "NuxtPicture", props: ["src", "alt", "width", "height", "loading", "sizes"] }
);

/** The components Nuxt registers itself, by name: what a story's template finds without importing them. */
export const BUILT_IN_COMPONENTS: Readonly<Record<string, Component>> = {
  NuxtLink,
  ClientOnly,
  DevOnly,
  NuxtLayout,
  NuxtErrorBoundary,
  NuxtPage,
  NuxtLoadingIndicator,
  NuxtRouteAnnouncer,
  NuxtImg,
  NuxtPicture
};
