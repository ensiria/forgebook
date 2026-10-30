/**
 * The story types for React: what a story file of a React library is written with
 * (`import type { Meta, Story } from "@forgebook/react"`).
 *
 * @remarks
 * The format's types (`@forgebook/story-format/csf`) are generic over a framework; these name them for React, so a
 * meta writes `satisfies Meta<typeof Button>` and its stories' args are the component's props, a prop that takes a
 * text also as `storyText("key")`. Types only: a library that writes stories depends on this package, never on the
 * catalogue that shows them (D-438).
 *
 * @module
 */
import type {
  Decorator as CsfDecorator,
  CsfMeta,
  CsfPreview,
  CsfStory,
  WrittenArg
} from "@forgebook/story-format/csf";
import type { ReactNode } from "react";

/**
 * Any function component (the library writes no class components); the props are what the stories' args fill in.
 * Its parameter is `never` so a component of any props is assignable to it.
 */
export type AnyComponent = (props: never) => ReactNode;

/** React, as the format's types read it. */
export type ReactRenderer = {
  /** A function component. */
  readonly component: AnyComponent;
  /** What a story draws. */
  readonly storyResult: ReactNode;
};

/** A component's props, every one optional: what a story's args may set, and what its render receives. */
export type ArgsOf<TComponent extends AnyComponent> = TComponent extends (props: infer TProps) => ReactNode
  ? Partial<TProps>
  : never;

/**
 * What a story's `args` may write: the component's props, every one optional, a prop that takes a text also as
 * `storyText("key")`. The render and the play function receive `ArgsOf`, the text already in the shown language.
 */
export type WrittenArgsOf<TComponent extends AnyComponent> = TComponent extends (
  props: infer TProps
) => ReactNode
  ? { [TName in keyof TProps]?: WrittenArg<TProps[TName]> }
  : never;

/** A page with no component (a foundations page): no args. */
export type NoComponent = () => ReactNode;

/** A React story file's default export: `{ title, component, args… } satisfies Meta<typeof Button>`. */
export type Meta<TComponent extends AnyComponent = NoComponent> = CsfMeta<
  ReactRenderer,
  TComponent,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** A React story: a named export of a story file. */
export type Story<TComponent extends AnyComponent = NoComponent> = CsfStory<
  ReactRenderer,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** Wraps a React story: a provider, a container of a given width. */
export type Decorator<TArgs> = CsfDecorator<ReactRenderer, TArgs>;

/**
 * A React catalogue's preview (`forgebook.preview.ts`): decorators around every story (its providers, the language's
 * reading `context.globals.lang`), parameters under every meta's, a setup before any story renders.
 */
export type Preview = CsfPreview<ReactRenderer>;
