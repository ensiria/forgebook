/**
 * The story types for Angular, and the helpers Storybook's Angular stories are written with: what a story file of an
 * Angular library imports (`import { type Meta, type Story, applicationConfig } from "@forgebook/angular"`).
 *
 * @remarks
 * The format's types (`@forgebook/story-format/csf`) are generic over a framework; these name them for Angular, so a
 * meta writes `satisfies Meta<typeof Badge>` and its stories' args are the component's inputs (a signal input's value,
 * a model's value and its `<name>Change`), its outputs as handlers, and its projected content, each as `#<selector>`.
 * A story draws what Storybook's Angular stories draw: the meta's component with its args, or a render's
 * `{ props, template, moduleMetadata, applicationConfig, styles }`. `moduleMetadata`, `applicationConfig`,
 * `componentWrapperDecorator` and `argsToTemplate` are Storybook's, under the same names, so its stories read as they
 * are.
 *
 * @module
 */

import {
  type ApplicationConfig,
  type EnvironmentProviders,
  type InputSignalWithTransform,
  type ModelSignal,
  type OutputRef,
  type Provider,
  reflectComponentType,
  type SchemaMetadata,
  type Type
} from "@angular/core";
import type {
  Decorator as CsfDecorator,
  CsfMeta,
  CsfPreview,
  CsfStory,
  StoryContext,
  StoryParameters,
  WrittenArg
} from "@forgebook/story-format/csf";

import { isBindingName } from "./bindingName.ts";
import { componentTemplate, propReference } from "./componentTemplate.ts";

/** Any class a story can name: a component, a directive, a service. */
export type AnyComponent = abstract new (...parameters: never[]) => unknown;

/**
 * What a story's template is compiled with, as Storybook's `moduleMetadata` writes it: the standalone components,
 * directives, pipes and modules it uses, the components it declares (those that are not standalone), the providers of
 * the story's own injector, and the schemas (`CUSTOM_ELEMENTS_SCHEMA`).
 */
export type ModuleMetadata = {
  /** Components, directives and pipes that are not standalone, declared for the story's template. */
  readonly declarations?: readonly Type<unknown>[];
  /** Standalone components, directives, pipes and modules the story's template uses, or lists of them. */
  readonly imports?: readonly (Type<unknown> | unknown[])[];
  /** Providers of the story's element injector, above the component's own. */
  readonly providers?: readonly Provider[];
  /** The schemas the story's template is checked with. */
  readonly schemas?: readonly SchemaMetadata[];
};

/**
 * What a story draws, as Storybook's Angular stories write it: props the template reads, the template itself (the
 * meta's component with its args when none), what it is compiled with, the application's providers, and styles of its
 * own.
 */
export type AngularStoryResult = {
  /** The values the template reads, by name; the meta's component takes them as inputs, outputs and content. */
  readonly props?: Readonly<Record<string, unknown>>;
  /** The template, compiled when the story is drawn; the meta's component with its props when none. */
  readonly template?: string;
  /** A component to draw with the props, instead of the meta's. */
  readonly component?: Type<unknown>;
  /** What the template is compiled with. */
  readonly moduleMetadata?: ModuleMetadata;
  /** The application the story is drawn in: its providers (`provideRouter`, `provideHttpClient`, an `APP_INITIALIZER`). */
  readonly applicationConfig?: ApplicationConfig;
  /** Styles of the story's own template. */
  readonly styles?: readonly string[];
};

/** Angular, as the format's types read it. */
export type AngularRenderer = {
  /** A component, a directive, or a function a story about logic documents. */
  readonly component: AnyComponent | AnyFunction;
  /** What a story draws. */
  readonly storyResult: AngularStoryResult;
};

/** An instance of a class. */
type InstanceOf<TComponent> = TComponent extends abstract new (
  ...parameters: never[]
) => infer TInstance
  ? TInstance
  : never;

/**
 * What a story sets for one member: a signal input's or a model's value as a binding writes it, an output's handler,
 * a decorated input's own type.
 */
type ArgOf<TMember> =
  // both inferred: the read type is invariant in a signal, so `unknown` there would match nothing
  TMember extends InputSignalWithTransform<infer _TRead, infer TWrite>
    ? TWrite
    : TMember extends OutputRef<infer TEvent>
      ? (value: TEvent) => void
      : TMember;

/** The `<name>Change` handler of each model, as a two-way binding listens to it. */
type ModelChangesOf<TInstance> = {
  [TName in keyof TInstance as TInstance[TName] extends ModelSignal<infer _TValue>
    ? `${TName & string}Change`
    : never]: TInstance[TName] extends ModelSignal<infer TValue> ? (value: TValue) => void : never;
};

/** The args that fill projected content: `#default`, and `#<selector>` for each `<ng-content select>`. */
export type ContentArgs = { readonly [TName in `#${string}`]?: string };

/** What a component's instance takes as args, each member as a binding sets it. */
type MembersOf<TInstance> = {
  [TName in keyof TInstance as IsArg<TInstance[TName]> extends true ? TName : never]: ArgOf<TInstance[TName]>;
} & ModelChangesOf<TInstance>;

/**
 * Whether a member can be an arg: an input or an output, or a field that is no function. A method, a lifecycle hook or
 * a signal of the component's own is not one.
 */
type IsArg<TMember> =
  TMember extends InputSignalWithTransform<infer _TRead, infer _TWrite>
    ? true
    : TMember extends OutputRef<infer _TEvent>
      ? true
      : TMember extends (...parameters: never[]) => unknown
        ? false
        : true;

/**
 * A component's args, every one optional: what a story's args may set, and what its render receives. An input with an
 * alias is set by the alias in a page, and typed here by its property's name.
 */
export type ArgsOf<TComponent> = Partial<MembersOf<InstanceOf<TComponent>>> & ContentArgs;

/**
 * What a story's `args` may write: the component's args, an input that takes a text also as `storyText("key")`. The
 * render and the play function receive `ArgsOf`, the text already in the shown language.
 */
export type WrittenArgsOf<TComponent> = {
  [TName in keyof MembersOf<InstanceOf<TComponent>>]?: WrittenArg<MembersOf<InstanceOf<TComponent>>[TName]>;
} & ContentArgs;

/** A page with no component (a foundations page): no args. */
export type NoComponent = abstract new () => Readonly<Record<never, never>>;

/** An Angular story file's default export: `{ title, component, args… } satisfies Meta<typeof Badge>`. */
export type Meta<TComponent extends AnyComponent = NoComponent> = CsfMeta<
  AngularRenderer,
  TComponent,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** An Angular story: a named export of a story file. */
export type Story<TComponent extends AnyComponent = NoComponent> = CsfStory<
  AngularRenderer,
  ArgsOf<TComponent>,
  WrittenArgsOf<TComponent>
>;

/** Any function a story about logic documents (an `inject…` helper); its parameter is `never` so any is assignable. */
export type AnyFunction = (...parameters: never[]) => unknown;

/** No args: a story about logic draws a scene of its own, which takes none. */
type NoArgs = Readonly<Record<string, never>>;

/**
 * The default export of a story file about logic, written `satisfies LogicMeta<typeof injectToggle>`: `parameters` must
 * say `logic: true`, so a function's file is never taken for a component's. Its component is the function, whose
 * signature the catalogue documents.
 */
export type LogicMeta<TFunction extends AnyFunction> = CsfMeta<AngularRenderer, TFunction, NoArgs, NoArgs> & {
  /** The catalogue's settings, `logic: true` among them. */
  readonly parameters: StoryParameters & { readonly logic: true };
};

/** A story about logic: a `render` that draws a scene using the function, required, and a `play` that tries it. */
export type LogicStory = CsfStory<AngularRenderer, NoArgs, NoArgs> &
  Required<Pick<CsfStory<AngularRenderer, NoArgs, NoArgs>, "render">>;

/** Wraps an Angular story: a provider, a container of a given width. */
export type Decorator<TArgs = Readonly<Record<string, unknown>>> = CsfDecorator<AngularRenderer, TArgs>;

/**
 * An Angular catalogue's preview (`forgebook.preview.ts`): decorators around every story (its providers, the
 * language's reading `context.globals.lang`), parameters under every meta's, a setup before any story renders.
 */
export type Preview = CsfPreview<AngularRenderer>;

/**
 * A decorator that adds to what the story's template is compiled with (Storybook's `moduleMetadata`): the story's own
 * metadata after these.
 *
 * @param metadata - the imports, declarations, providers and schemas to add.
 */
export const moduleMetadata =
  <TArgs = Readonly<Record<string, unknown>>>(metadata: ModuleMetadata): Decorator<TArgs> =>
  (story: () => AngularStoryResult): AngularStoryResult => {
    const drawn = story();
    const own = drawn.moduleMetadata ?? {};
    return {
      ...drawn,
      moduleMetadata: {
        declarations: [...(metadata.declarations ?? []), ...(own.declarations ?? [])],
        imports: [...(metadata.imports ?? []), ...(own.imports ?? [])],
        providers: [...(metadata.providers ?? []), ...(own.providers ?? [])],
        schemas: [...(metadata.schemas ?? []), ...(own.schemas ?? [])]
      }
    };
  };

/**
 * A decorator that adds to the application the story is drawn in (Storybook's `applicationConfig`): its providers
 * before the story's own.
 *
 * @param config - the application's configuration: `providers` (`provideRouter([])`, `provideAnimationsAsync()`).
 */
export const applicationConfig =
  <TArgs = Readonly<Record<string, unknown>>>(config: ApplicationConfig): Decorator<TArgs> =>
  (story: () => AngularStoryResult): AngularStoryResult => {
    const drawn = story();
    const providers: (Provider | EnvironmentProviders)[] = [
      ...config.providers,
      ...(drawn.applicationConfig?.providers ?? [])
    ];
    return { ...drawn, applicationConfig: { ...config, ...drawn.applicationConfig, providers } };
  };

/**
 * Whether a wrapper is a component rather than a function writing markup: Angular gives a component's class its
 * definition, compiled ahead of time or on first use.
 *
 * @param element - the wrapper.
 */
const isComponentClass = (element: Type<unknown> | ((story: string) => string)): element is Type<unknown> =>
  "ɵcmp" in element;

/**
 * A decorator that wraps the story's template (Storybook's `componentWrapperDecorator`): in a component of the
 * library, with the story inside its content, or in the markup a function writes around it.
 *
 * @param element - the wrapping component, or a function from the story's template to the wrapping one.
 * @param props - the wrapper's own props, or a function from the story's context to them.
 */
export const componentWrapperDecorator =
  <TArgs = Readonly<Record<string, unknown>>>(
    element: Type<unknown> | ((story: string) => string),
    props?:
      | Readonly<Record<string, unknown>>
      | ((context: StoryContext<TArgs>) => Readonly<Record<string, unknown>>)
  ): Decorator<TArgs> =>
  (story: () => AngularStoryResult, context: StoryContext<TArgs>): AngularStoryResult => {
    const drawn = story();
    const own = typeof props === "function" ? props(context) : props;
    const inner = drawn.template ?? "";
    if (!isComponentClass(element)) return withProps({ ...drawn, template: element(inner) }, own);
    // the wrapper is compiled with the story's template: a standalone one imported, another declared
    const metadata = drawn.moduleMetadata ?? {};
    const isStandalone = reflectComponentType(element)?.isStandalone ?? true;
    return withProps(
      {
        ...drawn,
        template: componentTemplate(element, own ?? {}, inner),
        moduleMetadata: isStandalone
          ? { ...metadata, imports: [...(metadata.imports ?? []), element] }
          : { ...metadata, declarations: [...(metadata.declarations ?? []), element] }
      },
      own
    );
  };

/**
 * A story result with a wrapper's props under the story's own.
 *
 * @param drawn - the result.
 * @param own - the wrapper's props; none leaves the result's.
 */
const withProps = (
  drawn: AngularStoryResult,
  own: Readonly<Record<string, unknown>> | undefined
): AngularStoryResult =>
  own === undefined && drawn.props === undefined ? drawn : { ...drawn, props: { ...own, ...drawn.props } };

/** What `argsToTemplate` keeps. */
export type ArgsToTemplateOptions<TName> = {
  /** Only these args; `exclude` is then not read. */
  readonly include?: readonly TName[];
  /** Every arg but these. */
  readonly exclude?: readonly TName[];
};

/**
 * The bindings of a story's args, for a template written by hand (Storybook's `argsToTemplate`): an input bound to each
 * arg with a value, an output to each handler (`[label]="label" (removed)="removed($event)"`). An arg left `undefined`
 * is not bound, so the input keeps its own default.
 *
 * @param args - the story's args.
 * @param options - which args to bind.
 */
export const argsToTemplate = <TArgs extends Readonly<Record<string, unknown>>>(
  args: TArgs,
  options: ArgsToTemplateOptions<keyof TArgs> = {}
): string => {
  const { include, exclude } = options;
  return (
    Object.entries(args)
      // an arg that is not a name (a `#` content, a name from a crafted address) is never written into the template
      .filter(([name, value]) => value !== undefined && isBindingName(name))
      .filter(([name]) =>
        include === undefined
          ? !(exclude ?? []).some((each) => each === name)
          : include.some((each) => each === name)
      )
      .map(([name, value]) =>
        typeof value === "function"
          ? `(${name})="${propReference(name)}($event)"`
          : `[${name}]="${propReference(name)}"`
      )
      .join(" ")
  );
};
