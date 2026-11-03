/**
 * The story types for Preact: what a story file of a Preact library is written with
 * (`import type { Meta, Story } from "@forgebook/preact"`).
 *
 * @remarks
 * The format's types (`@forgebook/story-format/csf`) are generic over a framework; these name them for Preact, so a
 * meta writes `satisfies Meta<typeof Button>` and its stories' args are the component's props, a prop that takes a
 * text also as `storyText("key")`. A component is a function or a class, as Preact draws both. Types only: a library
 * that writes stories depends on this package, never on the catalogue that shows them.
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
import type { ComponentChildren } from "preact";

/**
 * Any component: a function of its props or a class. The props are what the stories' args fill in; they are `never`
 * here so a component of any props is assignable.
 */
export type AnyComponent =
  | ((props: never, context?: never) => ComponentChildren)
  | (new (
      props: never,
      context?: never
    ) => { readonly render: (...parameters: never[]) => ComponentChildren });

/** Preact, as the format's types read it. */
export type PreactRenderer = {
  /** A component. */
  readonly component: AnyComponent;
  /** What a story draws. */
  readonly storyResult: ComponentChildren;
};

/** A component's props, as its class or its function takes them. */
type PropsOf<TComponent> = TComponent extends new (
  props: infer TProps,
  ...rest: never[]
) => unknown
  ? TProps
  : TComponent extends (props: infer TProps, ...rest: never[]) => unknown
    ? TProps
    : never;

/** A component's props, every one optional: what a story's args may set, and what its render receives. */
export type ArgsOf<TComponent extends AnyComponent> = Partial<PropsOf<TComponent>>;

/**
 * What a story's `args` may write: the component's props, every one optional, a prop that takes a text also as
 * `storyText("key")`. The render and the play function receive `ArgsOf`, the text already in the shown language.
 */
export type WrittenArgsOf<TComponent extends AnyComponent> = {
  [TName in keyof PropsOf<TComponent>]?: WrittenArg<PropsOf<TComponent>[TName]>;
};

/** A page with no component (a foundations page): no args. */
export type NoComponent = () => null;

/** A Preact story file's default export: `{ title, component, args… } satisfies Meta<typeof Button>`. */
export type Meta<TComponent extends AnyComponent = NoComponent> = CsfMeta<
  PreactRenderer,
  TComponent,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** A Preact story: a named export of a story file. */
export type Story<TComponent extends AnyComponent = NoComponent> = CsfStory<
  PreactRenderer,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** Any hook or function a story about logic documents; its parameter is `never` so any signature is assignable. */
export type AnyFunction = (...parameters: never[]) => unknown;

/** No args: a story about logic draws a scene of its own, which takes none. */
type NoArgs = Readonly<Record<string, never>>;

/**
 * The default export of a story file about logic, written `satisfies LogicMeta<typeof useUndo>`: `parameters` must say
 * `logic: true`, so a hook's file is never taken for a component's. Its component is the hook or the function, whose
 * signature the catalogue documents.
 */
export type LogicMeta<TFunction extends AnyFunction> = CsfMeta<PreactRenderer, TFunction, NoArgs, NoArgs> & {
  /** The catalogue's settings, `logic: true` among them. */
  readonly parameters: StoryParameters & { readonly logic: true };
};

/**
 * A story about logic: a `render` that draws a scene using the hook, required (without one, the catalogue would draw
 * the hook as a component), and a `play` that tries it.
 */
export type LogicStory = CsfStory<PreactRenderer, NoArgs, NoArgs> &
  Required<Pick<CsfStory<PreactRenderer, NoArgs, NoArgs>, "render">>;

/** Wraps a Preact story: a provider, a container of a given width. */
export type Decorator<TArgs> = CsfDecorator<PreactRenderer, TArgs>;

/**
 * A Preact catalogue's preview (`forgebook.preview.ts`): decorators around every story (its providers, the language's
 * reading `context.globals.lang`), parameters under every meta's, a setup before any story renders.
 */
export type Preview = CsfPreview<PreactRenderer>;
