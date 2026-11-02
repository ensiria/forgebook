/**
 * The story types for plain HTML: what a story file of a library with no framework is written with
 * (`import type { Meta, Story } from "@forgebook/html"`).
 *
 * @remarks
 * A story draws an HTML string or a DOM node, as Storybook's HTML stories do, in JavaScript or TypeScript. Its args are
 * the parameters of the function that draws it: the meta's `component` (`createButton(args)`, called with the args when
 * a story has no render of its own) or the story's `render`. `satisfies Meta<typeof createButton>` types the args from
 * the function's first parameter, and `satisfies Meta<ButtonArgs>` from a type written for them, as Storybook's
 * `Meta<ButtonArgs>` does; a field that takes a text also takes `storyText("key")`. Types only: a library that writes
 * stories depends on this package, never on the catalogue that shows them.
 *
 * @module
 */
import type {
  Decorator as CsfDecorator,
  CsfMeta,
  CsfPreview,
  CsfStory,
  StoryContext,
  StoryParameters,
  WrittenArg
} from "@forgebook/story-format/csf";

/** What a story draws: a text, which is HTML (`"<button>Save</button>"`), or a DOM node. */
export type HtmlStoryResult = string | Node;

/**
 * Any function that draws: a meta's `component`. Its parameters are `never` so a function of any args is assignable to
 * it.
 */
export type AnyStoryFunction = (args: never, context: never) => HtmlStoryResult;

/** Plain HTML, as the format's types read it. */
export type HtmlRenderer = {
  /** A function that draws from its args. */
  readonly component: AnyStoryFunction;
  /** What a story draws. */
  readonly storyResult: HtmlStoryResult;
};

/** No args: a story file that names neither a function nor a type of args. */
export type NoArgs = Readonly<Record<string, never>>;

/**
 * The args of what a meta names: a function's first parameter, or the type of args itself.
 *
 * @typeParam TSubject - `typeof createButton`, or `ButtonArgs`.
 */
type ParameterOf<TSubject> = TSubject extends (...parameters: infer TParameters) => HtmlStoryResult
  ? TParameters extends readonly [(infer TArgs)?, ...unknown[]]
    ? NonNullable<TArgs>
    : NoArgs
  : TSubject;

/** A story's args, every one optional: what its args may set, and what its render receives. */
export type ArgsOf<TSubject> = Partial<ParameterOf<TSubject>>;

/**
 * What a story's `args` may write: the args, every one optional, one that takes a text also as `storyText("key")`. The
 * render and the play function receive `ArgsOf`, the text already in the shown language.
 */
export type WrittenArgsOf<TSubject> = {
  [TName in keyof ParameterOf<TSubject>]?: WrittenArg<ParameterOf<TSubject>[TName]>;
};

/** The function a meta may name for a subject: the function itself, or one that draws from the type of args. */
type ComponentOf<TSubject> = TSubject extends AnyStoryFunction
  ? TSubject
  : (args: ArgsOf<TSubject>, context: StoryContext<ArgsOf<TSubject>>) => HtmlStoryResult;

/**
 * An HTML story file's default export: `{ title, component, args… } satisfies Meta<typeof createButton>`, or
 * `{ title, render, argTypes… } satisfies Meta<ButtonArgs>`.
 */
export type Meta<TSubject = NoArgs> = CsfMeta<
  HtmlRenderer,
  ComponentOf<TSubject>,
  ArgsOf<TSubject>,
  WrittenArgsOf<TSubject>
>;

/** An HTML story: a named export of a story file. */
export type Story<TSubject = NoArgs> = CsfStory<HtmlRenderer, ArgsOf<TSubject>, WrittenArgsOf<TSubject>>;

/** Any function a story about logic documents; its parameter is `never` so any signature is assignable. */
export type AnyFunction = (...parameters: never[]) => unknown;

/**
 * The default export of a story file about logic (a formatter, a helper), written
 * `satisfies LogicMeta<typeof formatDate>`: `parameters` must say `logic: true`, so the function is documented by its
 * signature and never called to draw.
 */
export type LogicMeta<TFunction extends AnyFunction> = Omit<
  CsfMeta<HtmlRenderer, AnyStoryFunction, NoArgs, NoArgs>,
  "component"
> & {
  /** The function the stories are about. */
  readonly component: TFunction;
  /** The catalogue's settings, `logic: true` among them. */
  readonly parameters: StoryParameters & { readonly logic: true };
};

/**
 * A story about logic: a `render` that draws a scene using the function, required (without one, the catalogue would
 * call the function to draw), and a `play` that tries it.
 */
export type LogicStory = CsfStory<HtmlRenderer, NoArgs, NoArgs> &
  Required<Pick<CsfStory<HtmlRenderer, NoArgs, NoArgs>, "render">>;

/**
 * Wraps an HTML story: a container of a given width, a theme's class. Its `story()` gives what the story drew, a text
 * or a node, as it was returned: a decorator that writes a text writes the inner one inside it, one that builds a node
 * appends the inner one.
 */
export type Decorator<TArgs> = CsfDecorator<HtmlRenderer, TArgs>;

/**
 * An HTML catalogue's preview (`forgebook.preview.ts`): decorators around every story (the language's reading
 * `context.globals.lang`), parameters under every meta's, a setup before any story renders.
 */
export type Preview = CsfPreview<HtmlRenderer>;
