/**
 * The story types for Vue: what a story file of a Vue library is written with
 * (`import type { Meta, Story } from "@forgebook/vue"`).
 *
 * @remarks
 * The format's types (`@forgebook/story-format/csf`) are generic over a framework; these name them for Vue, so a meta
 * writes `satisfies Meta<typeof Button>` and its stories' args are the component's props and listeners, a prop that
 * takes a text also as `storyText("key")`, and its slots, each as `#name`. Types only: a library that writes stories
 * depends on this package, never on the catalogue that shows them. A single-file component has its real types under
 * `vue-tsc`; plain `tsc` sees the project's `*.vue` shim.
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
import type { Component, VNode, VNodeChild } from "vue";

/** Any component: a single-file component, one from `defineComponent`, a functional one. */
export type AnyComponent = Component | ((...parameters: never[]) => unknown);

/** What a story draws: a virtual node or a text, or a component (`{ template, setup }`), as Storybook's Vue stories do. */
export type VueStoryResult = Component | VNodeChild;

/** Vue, as the format's types read it. */
export type VueRenderer = {
  /** A component. */
  readonly component: AnyComponent;
  /** What a story draws. */
  readonly storyResult: VueStoryResult;
  /** What a decorator's `story()` gives: a virtual node, which also works as a component (`components: { story }`). */
  readonly decoratedStory: VNode;
};

/** A component's props and listeners, as its instance or its function takes them. */
type PropsOf<TComponent> = TComponent extends new (
  ...parameters: never[]
) => Readonly<Record<"$props", infer TProps>>
  ? TProps
  : TComponent extends (props: infer TProps, ...rest: never[]) => unknown
    ? TProps
    : Readonly<Record<string, unknown>>;

/** A component's slots, as its instance or its function's context gives them. */
type SlotsOf<TComponent> = TComponent extends new (
  ...parameters: never[]
) => Readonly<Record<"$slots", infer TSlots>>
  ? TSlots
  : TComponent extends (props: never, context: infer TContext) => unknown
    ? TContext extends Readonly<Record<"slots", infer TSlots>>
      ? TSlots
      : Readonly<Record<never, never>>
    : Readonly<Record<never, never>>;

/** What fills a slot: a text, or a function that draws it from what the slot passes. */
export type SlotArg<TSlot = () => unknown> =
  | string
  | (NonNullable<TSlot> extends (...scope: infer TScope) => unknown
      ? (...scope: TScope) => VNodeChild
      : () => VNodeChild);

/**
 * The args that fill a component's slots, each as `#name`. Vue types an instance's `$slots` with an index signature too,
 * which is left out, so a slot the component does not have is an error.
 */
type SlotArgsOf<TComponent> = {
  [TName in keyof SlotsOf<TComponent> as TName extends string
    ? string extends TName
      ? never
      : `#${TName}`
    : never]?: SlotArg<SlotsOf<TComponent>[TName]>;
} & {
  /** The default slot, as Storybook's Vue stories write it. */
  default?: SlotArg;
};

/** A component's args, every one optional: what a story's args may set, and what its render receives. */
export type ArgsOf<TComponent> = Partial<PropsOf<TComponent>> & SlotArgsOf<TComponent>;

/**
 * What a story's `args` may write: the component's props, every one optional, a prop that takes a text also as
 * `storyText("key")`, and its slots. The render and the play function receive `ArgsOf`, the text already in the shown
 * language.
 */
export type WrittenArgsOf<TComponent> = {
  [TName in keyof PropsOf<TComponent>]?: WrittenArg<PropsOf<TComponent>[TName]>;
} & SlotArgsOf<TComponent>;

/** A page with no component (a foundations page): no args. */
export type NoComponent = () => null;

/** A Vue story file's default export: `{ title, component, args… } satisfies Meta<typeof Button>`. */
export type Meta<TComponent extends AnyComponent = NoComponent> = CsfMeta<
  VueRenderer,
  TComponent,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** A Vue story: a named export of a story file. */
export type Story<TComponent extends AnyComponent = NoComponent> = CsfStory<
  VueRenderer,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** Any composable or function a story about logic documents; its parameter is `never` so any signature is assignable. */
export type AnyFunction = (...parameters: never[]) => unknown;

/** No args: a story about logic draws a scene of its own, which takes none. */
type NoArgs = Readonly<Record<string, never>>;

/**
 * The default export of a story file about logic, written `satisfies LogicMeta<typeof useToggle>`: `parameters` must say
 * `logic: true`, so a composable's file is never taken for a component's. Its component is the composable or the
 * function, whose signature the catalogue documents.
 */
export type LogicMeta<TFunction extends AnyFunction> = CsfMeta<VueRenderer, TFunction, NoArgs, NoArgs> & {
  /** The catalogue's settings, `logic: true` among them. */
  readonly parameters: StoryParameters & { readonly logic: true };
};

/**
 * A story about logic: a `render` that draws a scene using the composable, required (without one, the catalogue would
 * draw the composable as a component), and a `play` that tries it.
 */
export type LogicStory = CsfStory<VueRenderer, NoArgs, NoArgs> &
  Required<Pick<CsfStory<VueRenderer, NoArgs, NoArgs>, "render">>;

/** Wraps a Vue story: a provider, a container of a given width. */
export type Decorator<TArgs> = CsfDecorator<VueRenderer, TArgs>;

/**
 * A Vue catalogue's preview (`forgebook.preview.ts`): decorators around every story (its providers, the language's
 * reading `context.globals.lang`), parameters under every meta's, a setup before any story renders.
 */
export type Preview = CsfPreview<VueRenderer>;
