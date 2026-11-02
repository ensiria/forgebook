/**
 * The story types for Web Components: what a story file of a custom elements library is written with
 * (`import type { Meta, Story } from "@forgebook/web-components"`).
 *
 * @remarks
 * The format's types (`@forgebook/story-format/csf`) are generic over a framework; these name them for custom elements.
 * A meta names its element by its tag (`component: "my-button"`, as Storybook's Web Components stories do) or by its
 * class (`component: MyButton`), and `satisfies Meta<"my-button">` or `Meta<typeof MyButton>` types its args from the
 * element: its own fields by name and as properties (`.items`), a field that takes a text also as `storyText("key")`.
 * An attribute named otherwise than its field (`max-length`), a listener (`@change`) and a slot (`#icon`) are args too,
 * which the element's type does not name (`argNames.ts`). A render returns what Lit draws: a template, a node, a text
 * (taken as HTML, as Storybook does) or nothing. Types only: a library that writes stories depends on this package,
 * never on the catalogue that shows them.
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
import type { LitElement, noChange, nothing, TemplateResult } from "lit";
import type { DirectiveResult } from "lit/directive.js";

/** A custom element as a meta names it: its tag (`"my-button"`) or its class. */
export type AnyElement = string | CustomElementConstructor;

/** What a story draws: what Lit's `render` takes, a text being HTML. */
export type WebComponentsStoryResult =
  | TemplateResult
  | DirectiveResult
  | Node
  | string
  | number
  | typeof nothing
  | typeof noChange
  | null
  | undefined
  | readonly WebComponentsStoryResult[];

/** Web Components, as the format's types read them. */
export type WebComponentsRenderer = {
  /** A custom element. */
  readonly component: AnyElement;
  /** What a story draws. */
  readonly storyResult: WebComponentsStoryResult;
};

/** The element a meta names: its tag's in `HTMLElementTagNameMap`, its class's instance, or any element. */
type ElementOf<TComponent> = TComponent extends keyof HTMLElementTagNameMap
  ? HTMLElementTagNameMap[TComponent]
  : TComponent extends abstract new (
        ...parameters: never[]
      ) => infer TElement
    ? TElement
    : HTMLElement;

/** A function: a method of the element, never an arg. */
type AnyMethod = (...parameters: never[]) => unknown;

/** The element's own fields: what neither `HTMLElement` nor Lit's base classes declare, methods left out. */
type OwnFields<TElement> = {
  [TName in keyof TElement as TName extends keyof LitElement
    ? never
    : TElement[TName] extends AnyMethod
      ? never
      : TName extends string
        ? TName
        : never]: TElement[TName];
};

/** The own fields as properties (`.items`), the way Lit binds one. */
type PropertyArgs<TFields> = { [TName in keyof TFields as `.${TName & string}`]?: TFields[TName] };

/** The own fields as properties, a field that takes a text also as `storyText("key")`. */
type WrittenPropertyArgs<TFields> = {
  [TName in keyof TFields as `.${TName & string}`]?: WrittenArg<TFields[TName]>;
};

/**
 * An element's args, every one optional: what a story's args may set, and what its render receives. Its fields are typed;
 * any other name (an attribute named otherwise, a listener, a slot) takes any value.
 */
export type ArgsOf<TComponent> = Partial<OwnFields<ElementOf<TComponent>>> &
  PropertyArgs<OwnFields<ElementOf<TComponent>>> &
  Readonly<Record<string, unknown>>;

/**
 * What a story's `args` may write: the element's fields, every one optional, a field that takes a text also as
 * `storyText("key")`. The render and the play function receive `ArgsOf`, the text already in the shown language.
 */
export type WrittenArgsOf<TComponent> = {
  [TName in keyof OwnFields<ElementOf<TComponent>>]?: WrittenArg<OwnFields<ElementOf<TComponent>>[TName]>;
} & WrittenPropertyArgs<OwnFields<ElementOf<TComponent>>> &
  Readonly<Record<string, unknown>>;

/** A Web Components story file's default export: `{ title, component, args… } satisfies Meta<"my-button">`. */
export type Meta<TComponent extends AnyElement = string> = CsfMeta<
  WebComponentsRenderer,
  TComponent,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** A Web Components story: a named export of a story file. */
export type Story<TComponent extends AnyElement = string> = CsfStory<
  WebComponentsRenderer,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** Any function a story about logic documents; its parameter is `never` so any signature is assignable. */
export type AnyFunction = (...parameters: never[]) => unknown;

/** No args: a story about logic draws a scene of its own, which takes none. */
type NoArgs = Readonly<Record<string, never>>;

/**
 * The default export of a story file about logic (a controller, a function), written
 * `satisfies LogicMeta<typeof formatDate>`: `parameters` must say `logic: true`, so a function's file is never taken for an element's. Its component
 * is the function, whose signature the catalogue documents.
 */
export type LogicMeta<TFunction extends AnyFunction> = Omit<
  CsfMeta<WebComponentsRenderer, AnyElement, NoArgs, NoArgs>,
  "component"
> & {
  /** The function the stories are about. */
  readonly component: TFunction;
  /** The catalogue's settings, `logic: true` among them. */
  readonly parameters: StoryParameters & { readonly logic: true };
};

/**
 * A story about logic: a `render` that draws a scene using the function, required (without one, the catalogue would
 * look for an element to draw), and a `play` that tries it.
 */
export type LogicStory = CsfStory<WebComponentsRenderer, NoArgs, NoArgs> &
  Required<Pick<CsfStory<WebComponentsRenderer, NoArgs, NoArgs>, "render">>;

/** Wraps a Web Components story: a provider element, a container of a given width. */
export type Decorator<TArgs> = CsfDecorator<WebComponentsRenderer, TArgs>;

/**
 * A Web Components catalogue's preview (`forgebook.preview.ts`): decorators around every story (the language's reading
 * `context.globals.lang`), parameters under every meta's, a setup before any story renders.
 */
export type Preview = CsfPreview<WebComponentsRenderer>;
