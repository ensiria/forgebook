/**
 * The story types for a Nuxt project: Vue's, with the `parameters.nuxt` a story sets its route, data, state, cookies and
 * config with (`import type { Meta, Story } from "@forgebook/nuxt"`).
 *
 * @remarks
 * Types only. `route` is a path or a location by path or by name, resolved against the project's pages
 * (`{ name: "blog-slug", params: { slug: "hello" } }` or `/blog/hello`); `data` is what `useAsyncData` and `useFetch`
 * return by key instead of calling their handler (`useFetch`'s key is the request as it is made, its URL with its query, unless it is given one).
 *
 * @module
 */

import type { StoryParameters } from "@forgebook/story-format/csf";
import type {
  AnyComponent,
  NoComponent,
  Meta as VueMeta,
  Preview as VuePreview,
  Story as VueStory
} from "@forgebook/vue";

import type { StoryLocation } from "./parameters.ts";

/** A story's Nuxt settings: where it starts, what its composables find, the config over the project's. */
export type NuxtParameters = {
  /**
   * Where the story starts: a path (`/blog/hello?tab=1`), a location by path (`{ path, query, hash }`) or by a page's
   * name (`{ name: "blog-slug", params: { slug: "hello" } }`); `/` by default.
   */
  readonly route?: StoryLocation;
  /** What `useAsyncData` and `useFetch` return, by key, without calling their handler. */
  readonly data?: Readonly<Record<string, unknown>>;
  /** What `useState` starts with, by key. */
  readonly state?: Readonly<Record<string, unknown>>;
  /** What `useCookie` reads, by name. */
  readonly cookies?: Readonly<Record<string, unknown>>;
  /** The runtime config's public values over the project's. */
  readonly runtimeConfig?: { readonly public?: Readonly<Record<string, unknown>> };
  /** The app config over the project's. */
  readonly appConfig?: Readonly<Record<string, unknown>>;
};

/** A story's parameters: the catalogue's settings, and its Nuxt ones. */
export type NuxtStoryParameters = StoryParameters & {
  /** The story's route, data, state, cookies and config. */
  readonly nuxt?: NuxtParameters;
};

/** A story file's default export: `{ title, component, parameters: { nuxt } } satisfies Meta<typeof Nav>`. */
export type Meta<TComponent extends AnyComponent = NoComponent> = Omit<VueMeta<TComponent>, "parameters"> & {
  /** Settings for every story of the file, its Nuxt among them. */
  readonly parameters?: NuxtStoryParameters;
};

/** A story: a named export of a story file. */
export type Story<TComponent extends AnyComponent = NoComponent> = Omit<
  VueStory<TComponent>,
  "parameters"
> & {
  /** Settings over the meta's, its Nuxt among them. */
  readonly parameters?: NuxtStoryParameters;
};

/** A Nuxt catalogue's preview (`forgebook.preview.ts`): Vue's, with Nuxt settings every story starts from. */
export type Preview = Omit<VuePreview, "parameters"> & {
  /** Settings every story starts from, its Nuxt among them. */
  readonly parameters?: NuxtStoryParameters;
};
