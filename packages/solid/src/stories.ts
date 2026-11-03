/**
 * The story types for Solid: what a story file of a Solid library is written with
 * (`import type { Meta, Story } from "@forgebook/solid"`).
 *
 * @remarks
 * The format's types (`@forgebook/story-format/csf`) are generic over a framework; these name them for Solid, so a
 * meta writes `satisfies Meta<typeof Button>` and its stories' args are the component's props, a prop that takes a
 * text also as `storyText("key")`. A render receives the args as props: reading `args.label` inside JSX follows it,
 * and spreading them (`<Button {...args} />`) keeps every one live. Types only: a library that writes stories depends
 * on this package, never on the catalogue that shows them.
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
import type { JSX } from "solid-js";

/**
 * Any component: a function of its props, run once (Solid's `Component`). The props are what the stories' args fill
 * in; they are `never` here so a component of any props is assignable.
 */
export type AnyComponent = (props: never) => JSX.Element;

/** Solid, as the format's types read it. */
export type SolidRenderer = {
  /** A component. */
  readonly component: AnyComponent;
  /** What a story draws. */
  readonly storyResult: JSX.Element;
};

/** A component's props, as its function takes them. */
type PropsOf<TComponent> = TComponent extends (props: infer TProps) => unknown ? TProps : never;

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

/** A Solid story file's default export: `{ title, component, args… } satisfies Meta<typeof Button>`. */
export type Meta<TComponent extends AnyComponent = NoComponent> = CsfMeta<
  SolidRenderer,
  TComponent,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** A Solid story: a named export of a story file. */
export type Story<TComponent extends AnyComponent = NoComponent> = CsfStory<
  SolidRenderer,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** Any primitive or function a story about logic documents (`createUndo`); its parameter is `never` so any signature is assignable. */
export type AnyFunction = (...parameters: never[]) => unknown;

/** No args: a story about logic draws a scene of its own, which takes none. */
type NoArgs = Readonly<Record<string, never>>;

/**
 * The default export of a story file about logic, written `satisfies LogicMeta<typeof createUndo>`: `parameters` must say
 * `logic: true`, so a primitive's file is never taken for a component's. Its component is the primitive or the function, whose
 * signature the catalogue documents.
 */
export type LogicMeta<TFunction extends AnyFunction> = CsfMeta<SolidRenderer, TFunction, NoArgs, NoArgs> & {
  /** The catalogue's settings, `logic: true` among them. */
  readonly parameters: StoryParameters & { readonly logic: true };
};

/**
 * A story about logic: a `render` that draws a scene using the primitive, required (without one, the catalogue would
 * draw the primitive as a component), and a `play` that tries it.
 */
export type LogicStory = CsfStory<SolidRenderer, NoArgs, NoArgs> &
  Required<Pick<CsfStory<SolidRenderer, NoArgs, NoArgs>, "render">>;

/** Wraps a Solid story: a provider, a container of a given width. */
export type Decorator<TArgs> = CsfDecorator<SolidRenderer, TArgs>;

/**
 * A Solid catalogue's preview (`forgebook.preview.ts`): decorators around every story (its providers, the language's
 * reading `context.globals.lang`), parameters under every meta's, a setup before any story renders.
 */
export type Preview = CsfPreview<SolidRenderer>;
