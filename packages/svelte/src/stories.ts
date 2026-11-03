/**
 * The story types for Svelte: what a story file of a Svelte library is written with
 * (`import type { Meta, Story } from "@forgebook/svelte"`).
 *
 * @remarks
 * The format's types (`@forgebook/story-format/csf`) are generic over a framework; these name them for Svelte 5, so a
 * meta writes `satisfies Meta<typeof Button>` and its stories' args are the component's props (its callback props
 * among them), a prop that takes a text also as `storyText("key")`, and a snippet's text as `#name`. Types only: a
 * library that writes stories depends on this package, never on the catalogue that shows them. A `.svelte` file has its
 * real types under `svelte-check`; plain `tsc` sees the project's `*.svelte` shim.
 *
 * @module
 */
import type {
  Decorator as CsfDecorator,
  CsfMeta,
  CsfPreview,
  CsfStory,
  StoryParameters,
  WrittenArg
} from "@forgebook/story-format/csf";
import type { Component, Snippet } from "svelte";

/**
 * Any Svelte 5 component: what a `.svelte` file exports, whatever its props. Its props are `never` because a component
 * that takes any props at all can stand for it.
 */
export type AnyComponent = Component<never, Record<string, unknown>, string>;

/** A component drawn with these props: what a render returns to draw a component with props of its choosing. */
export type StoryComponent = {
  /** The component. */
  // biome-ignore lint/style/useNamingConvention: Storybook's Svelte stories write `Component`, so theirs read unchanged
  readonly Component: AnyComponent;
  /** Its props; a snippet's text as `#name`, as in the args. None draws it with none. */
  readonly props?: Readonly<Record<string, unknown>>;
};

/**
 * What a story draws: a component, drawn with the args, or a component with props of its choosing
 * (`{ Component: Button, props: { ...args, tone: "danger" } }`), as Storybook's Svelte stories write it. What a
 * decorator returns is drawn around the story, which reaches its component as `children`.
 */
export type SvelteStoryResult = AnyComponent | StoryComponent;

/** Svelte, as the format's types read it. */
export type SvelteRenderer = {
  /** A component. */
  readonly component: AnyComponent;
  /** What a story draws. */
  readonly storyResult: SvelteStoryResult;
};

/** A component's props, as its function is called with them. */
type PropsOf<TComponent extends AnyComponent> = TComponent extends (
  internals: never,
  props: infer TProps
) => unknown
  ? TProps
  : Readonly<Record<string, never>>;

/** Whether a prop takes a snippet: what it renders is what a snippet returns. */
type IsSnippet<TValue> =
  NonNullable<TValue> extends (...parameters: never) => infer TResult
    ? TResult extends ReturnType<Snippet>
      ? true
      : false
    : false;

/** The args that fill a component's snippets with a text, each as `#name`. */
type SnippetArgsOf<TComponent extends AnyComponent> = {
  [TName in keyof PropsOf<TComponent> as TName extends string
    ? IsSnippet<PropsOf<TComponent>[TName]> extends true
      ? `#${TName}`
      : never
    : never]?: WrittenArg<string>;
};

/** A component's args, every one optional: what a story's args may set, and what its render receives. */
export type ArgsOf<TComponent extends AnyComponent> = Partial<PropsOf<TComponent>> &
  SnippetArgsOf<TComponent>;

/**
 * What a story's `args` may write: the component's props, every one optional, a prop that takes a text also as
 * `storyText("key")`, and its snippets' texts. The render and the play function receive `ArgsOf`, the text already in
 * the shown language.
 */
export type WrittenArgsOf<TComponent extends AnyComponent> = {
  [TName in keyof PropsOf<TComponent>]?: WrittenArg<PropsOf<TComponent>[TName]>;
} & SnippetArgsOf<TComponent>;

/** A page with no component (a foundations page): no args. */
export type NoComponent = Component<Record<string, never>>;

/** A Svelte story file's default export: `{ title, component, args… } satisfies Meta<typeof Button>`. */
export type Meta<TComponent extends AnyComponent = NoComponent> = CsfMeta<
  SvelteRenderer,
  TComponent,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** A Svelte story: a named export of a story file. */
export type Story<TComponent extends AnyComponent = NoComponent> = CsfStory<
  SvelteRenderer,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** Any function a story about logic documents; its parameter is `never` so any signature is assignable. */
export type AnyFunction = (...parameters: never[]) => unknown;

/** No args: a story about logic draws a scene of its own, which takes none. */
type NoArgs = Readonly<Record<string, never>>;

/**
 * The default export of a story file about logic, written `satisfies LogicMeta<typeof createToggle>`: `parameters` must
 * say `logic: true`, so a function's file is never taken for a component's. Its component is the function (in a
 * `.svelte.ts` module, with runes), whose signature the catalogue documents.
 */
export type LogicMeta<TFunction extends AnyFunction> = CsfMeta<SvelteRenderer, TFunction, NoArgs, NoArgs> & {
  /** The catalogue's settings, `logic: true` among them. */
  readonly parameters: StoryParameters & { readonly logic: true };
};

/**
 * A story about logic: a `render` that draws a scene using the function, required (without one, the catalogue would
 * draw the function as a component), and a `play` that tries it.
 */
export type LogicStory = CsfStory<SvelteRenderer, NoArgs, NoArgs> &
  Required<Pick<CsfStory<SvelteRenderer, NoArgs, NoArgs>, "render">>;

/** Wraps a Svelte story: a provider, a container of a given width, drawn around it. */
export type Decorator<TArgs> = CsfDecorator<SvelteRenderer, TArgs>;

/**
 * A Svelte catalogue's preview (`forgebook.preview.ts`): decorators around every story (its providers, the language's
 * reading `context.globals.lang`), parameters under every meta's, a setup before any story renders.
 */
export type Preview = CsfPreview<SvelteRenderer>;
