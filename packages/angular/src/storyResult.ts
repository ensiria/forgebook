/**
 * A story drawn as Angular reads it: its render (or the meta's component) inside its decorators, the story's, the meta's
 * and the catalogue's (its preview's), in that order outward, as one `AngularStoryResult`, and whether the result is the
 * component alone, which needs no template compiled.
 *
 * @remarks
 * A story of the meta's component has its template computed first, as Storybook's Angular stories do, so a decorator
 * that wraps `story().template` finds the component in it. When no decorator changed that template, the frame draws
 * the component itself, with its args as inputs, outputs and content: no template is compiled, and the page loads no
 * compiler. A render may also return a component class, drawn with the story's args.
 *
 * @module
 */

import type { ApplicationConfig, EnvironmentProviders, Provider, SchemaMetadata, Type } from "@angular/core";
import type { StoryContext } from "@forgebook/story-format/csf";
import type { LoadedArgs, LoadedDecorator, LoadedStory } from "forgebook/story-module";

import { componentTemplate } from "./componentTemplate.ts";
import type { AngularStoryResult, ModuleMetadata } from "./stories.ts";

/** A story, composed. */
export type ComposedStory = {
  /** What the story draws, with every decorator applied. */
  readonly result: AngularStoryResult;
  /** The component drawn alone, when the result is the component with its props and nothing else to compile. */
  readonly component: Type<unknown> | undefined;
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether a value is a class Angular can draw: a function with a prototype (an arrow function has none). Angular's own
 * check, its definition, is read where it is used.
 */
export const isClass = (value: unknown): value is Type<unknown> =>
  typeof value === "function" && value.prototype !== undefined;

/** Whether a value is a list. */
const isList = (value: unknown): value is unknown[] => Array.isArray(value);

/**
 * Whether a value can be a provider: a class, a provider's object (`{ provide, useValue }`, Angular's environment
 * providers), or a list of them. Angular says what is wrong with one when it reads it.
 */
const isProvider = (value: unknown): value is Provider | EnvironmentProviders => isElementProvider(value);

/** Whether a value can be a provider of an element injector: a class, a provider's object, or a list of them. */
const isElementProvider = (value: unknown): value is Provider =>
  typeof value === "function" || isRecord(value) || isList(value);

/** Whether a value is a schema (`CUSTOM_ELEMENTS_SCHEMA`), kept as it is: Angular compares schemas by identity. */
const isSchema = (value: unknown): value is SchemaMetadata =>
  isRecord(value) && typeof value["name"] === "string";

/** A story's styles, when a result gives a list of texts. */
const stylesOf = (value: unknown): readonly string[] | undefined =>
  isList(value) && value.every((style) => typeof style === "string") ? value.map(String) : undefined;

/** What a result's `moduleMetadata` gives, each list kept when it is one. */
const metadataOf = (value: unknown): ModuleMetadata | undefined => {
  if (!isRecord(value)) return undefined;
  const list = (name: string): readonly unknown[] => {
    const field = value[name];
    return isList(field) ? field : [];
  };
  return {
    declarations: list("declarations").filter(isClass),
    imports: list("imports").filter((each) => isClass(each) || isList(each)),
    providers: list("providers").filter(isElementProvider),
    schemas: list("schemas").filter(isSchema)
  };
};

/** What a result's `applicationConfig` gives: its providers. */
const applicationConfigOf = (value: unknown): ApplicationConfig | undefined => {
  if (!isRecord(value)) return undefined;
  const providers = value["providers"];
  return { providers: isList(providers) ? providers.filter(isProvider) : [] };
};

/**
 * What a render or a decorator returned, read as a story result: the object it wrote, or a class to draw with the
 * story's args.
 *
 * @param value - what it returned.
 * @param args - the story's args, the props of a class returned alone.
 */
const asResult = (value: unknown, args: LoadedArgs): AngularStoryResult => {
  if (isClass(value)) return { component: value, props: args };
  if (!isRecord(value)) return {};
  const { props, template, component, moduleMetadata, applicationConfig, styles } = value;
  const metadata = metadataOf(moduleMetadata);
  const config = applicationConfigOf(applicationConfig);
  const ownStyles = stylesOf(styles);
  return {
    ...(isRecord(props) ? { props } : {}),
    ...(typeof template === "string" ? { template } : {}),
    ...(isClass(component) ? { component } : {}),
    ...(metadata === undefined ? {} : { moduleMetadata: metadata }),
    ...(config === undefined ? {} : { applicationConfig: config }),
    ...(ownStyles === undefined ? {} : { styles: ownStyles })
  };
};

/**
 * The story with these args: its render (or the meta's component), inside its decorators.
 *
 * @param loaded - the story.
 * @param context - the args and the canvas its render, play and decorators read.
 * @param outer - the catalogue's decorators, outside the story's and the meta's.
 * @throws what the render or a decorator throws, and when a component story's component is a directive.
 */
export const composedStory = (
  loaded: LoadedStory,
  context: StoryContext<LoadedArgs>,
  outer: readonly LoadedDecorator[]
): ComposedStory => {
  let computed: { readonly component: Type<unknown>; readonly template: string } | undefined;
  const renderStory = (): AngularStoryResult => {
    const drawn =
      loaded.render === undefined
        ? { props: context.args }
        : asResult(loaded.render(context.args, context), context.args);
    const component = drawn.component ?? (isClass(loaded.component) ? loaded.component : undefined);
    if (drawn.template !== undefined || component === undefined) return drawn;
    const template = componentTemplate(component, drawn.props ?? {});
    computed = { component, template };
    return { ...drawn, component, template };
  };
  const decorated = [...loaded.decorators, ...outer].reduce<() => AngularStoryResult>(
    (inner, decorator) => (): AngularStoryResult => asResult(decorator(inner, context), context.args),
    renderStory
  );
  const result = decorated();
  const isAlone =
    computed !== undefined && result.template === computed.template && (result.styles ?? []).length === 0;
  return { result, component: isAlone ? computed?.component : undefined };
};
