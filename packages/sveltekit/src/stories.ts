/**
 * The story types for a SvelteKit project: Svelte's, with the `parameters.sveltekit` a story sets its page, its data
 * and its navigation with (`import type { Meta, Story } from "@forgebook/sveltekit"`).
 *
 * @remarks
 * `navigation`, `forms` and `hrefs` are written as Storybook's SvelteKit framework writes them under
 * `sveltekit_experimental`, which is read too, so a story moved from Storybook keeps its page; `page`, `load` and
 * `serverData` are Forgebook's. Types only.
 *
 * @module
 */

import type { StoryParameters } from "@forgebook/story-format/csf";
import type {
  AnyComponent,
  NoComponent,
  Meta as SvelteMeta,
  Preview as SveltePreview,
  Story as SvelteStory
} from "@forgebook/svelte";

import type {
  HrefParameter,
  KitActionResult,
  KitLoadEvent,
  KitPage,
  PageParameters,
  StoryLoad,
  SveltekitParameters
} from "./kitParameters.ts";

/** A story's SvelteKit settings (`parameters.sveltekit`). */
export type StorySveltekit = SveltekitParameters;

/** The page a story starts on (`parameters.sveltekit.page`). */
export type StoryPageParameters = PageParameters;

/** The page a story's components read, as `page` from `$app/state` gives it. */
export type StoryKitPage = KitPage;

/** A universal `load` a story runs (`parameters.sveltekit.load`). */
export type StoryKitLoad = StoryLoad;

/** What a story's `load` receives. */
export type StoryKitLoadEvent = KitLoadEvent;

/** An action's result, as `parameters.sveltekit.forms.result` gives it. */
export type StoryActionResult = KitActionResult;

/** An `hrefs` entry: a callback, or one with whether its key is a regular expression. */
export type StoryHref = HrefParameter;

/** A story's parameters: the catalogue's settings, and its SvelteKit ones. */
export type SveltekitStoryParameters = StoryParameters & {
  /** The story's page, its data and what its navigation, forms and links do. */
  readonly sveltekit?: StorySveltekit;
};

/** A story file's default export: `{ title, component, parameters: { sveltekit } } satisfies Meta<typeof Nav>`. */
export type Meta<TComponent extends AnyComponent = NoComponent> = Omit<
  SvelteMeta<TComponent>,
  "parameters"
> & {
  /** Settings for every story of the file, its page among them. */
  readonly parameters?: SveltekitStoryParameters;
};

/** A story: a named export of a story file. */
export type Story<TComponent extends AnyComponent = NoComponent> = Omit<
  SvelteStory<TComponent>,
  "parameters"
> & {
  /** Settings over the meta's, its page among them. */
  readonly parameters?: SveltekitStoryParameters;
};

/** A SvelteKit catalogue's preview (`forgebook.preview.ts`): Svelte's, with a page every story starts from. */
export type Preview = Omit<SveltePreview, "parameters"> & {
  /** Settings every story starts from, a page among them. */
  readonly parameters?: SveltekitStoryParameters;
};
