/**
 * What the browser's renderer and the server's share: the host component a story's template is compiled in, the
 * application providers every story gets, and the shape that says whether new args can be set on what is drawn.
 *
 * @remarks
 * The host is a standalone component made when a story is drawn, its template the story's, compiled by Angular's
 * compiler, which is loaded on first use: a page whose stories all draw their component alone never loads it. The
 * host's fields are the story's props, as Storybook's Angular stories have them, so a template reads `label` or
 * `this['#default']`.
 *
 * @module
 */
import {
  Component,
  type EnvironmentProviders,
  NgModule,
  type Provider,
  provideZonelessChangeDetection,
  reflectComponentType,
  type Type,
  VERSION
} from "@angular/core";

import type { AngularStoryResult } from "./stories.ts";
import type { ComposedStory } from "./storyResult.ts";

/** The element a story's host is drawn as. */
export const HOST_SELECTOR = "forgebook-story";

/** What a story is compiled with: other args keep it, another one draws the story anew. */
export type StoryShape = Readonly<Record<string, unknown>>;

/** An error as the frame takes it. */
export const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/**
 * What a story is compiled with: the component drawn alone and the content it projects, or the template and what it
 * is compiled with; the application's providers in both.
 *
 * @param composed - the story.
 */
export const shapeOf = (composed: ComposedStory): StoryShape => {
  const { result, component } = composed;
  const base = { metadata: result.moduleMetadata, config: result.applicationConfig };
  if (component === undefined)
    return { ...base, template: result.template, component: result.component, styles: result.styles };
  // the content projected is fixed when the component is made: filling another one makes it anew
  const contents = Object.entries(result.props ?? {})
    .filter(([name, value]) => name.startsWith("#") && value !== undefined)
    .map(([name]) => name);
  return { ...base, component, contents };
};

/** Whether a value is a plain object or list, compared by its content; anything else is compared by identity. */
const isPlain = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" &&
  value !== null &&
  (Array.isArray(value) ||
    Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);

/**
 * Whether two shapes are the same: plain objects and lists by their content (a render writes new ones each time),
 * classes, tokens and functions by identity.
 *
 * @param left - one shape, or a value inside one.
 * @param right - the other.
 */
export const isSameShape = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (!isPlain(left) || !isPlain(right) || Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => key in right && isSameShape(left[key], right[key]))
  );
};

/**
 * The providers of a story's application: zoneless change detection where Angular does not default to it (version 20),
 * then the story's `applicationConfig`.
 *
 * @param result - what the story draws.
 */
export const applicationProviders = (result: AngularStoryResult): (Provider | EnvironmentProviders)[] => [
  ...(VERSION.major === "20" ? [provideZonelessChangeDetection()] : []),
  ...(result.applicationConfig?.providers ?? [])
];

/** A story's host: a component whose fields are the story's props. */
export type StoryHost = Type<Record<string, unknown>>;

/**
 * Whether a class can be imported by a standalone host: a standalone component, or a directive or a pipe, which are
 * standalone by default since Angular 19 (one that is not belongs in `declarations`).
 *
 * @param type - the class.
 */
const isStandalone = (type: Type<unknown>): boolean => reflectComponentType(type)?.isStandalone ?? true;

/**
 * What a story's host imports: the metadata's imports, the components the template may use (standalone ones imported,
 * others declared), and a module of its own declaring what is not standalone.
 *
 * @param result - what the story draws.
 * @param component - the meta's component; none for a page with none.
 */
const hostImports = (
  result: AngularStoryResult,
  component: Type<unknown> | undefined
): (Type<unknown> | unknown[])[] => {
  const metadata = result.moduleMetadata ?? {};
  const declarations = [...(metadata.declarations ?? [])];
  const imports = [...(metadata.imports ?? [])];
  for (const each of [component, result.component]) {
    if (each === undefined || declarations.includes(each) || imports.includes(each)) continue;
    if (isStandalone(each)) imports.push(each);
    else declarations.push(each);
  }
  if (declarations.length === 0) return imports;
  class StoryDeclarations {}
  NgModule({ declarations, imports: [...imports], exports: [...declarations, ...imports] })(
    StoryDeclarations
  );
  return [...imports, StoryDeclarations];
};

/**
 * The host of a story's template, compiled: Angular's compiler is loaded first, on first use.
 *
 * @param result - what the story draws: its template, its component, its metadata and styles.
 * @param component - the meta's component, which the template may use; none for a page with none.
 * @returns the host, whose instance starts with the story's props.
 */
export const compiledHost = async (
  result: AngularStoryResult,
  component: Type<unknown> | undefined
): Promise<StoryHost> => {
  const { publishFacade } = await import("@angular/compiler");
  // a build marks Angular's compiler free of side effects, and its registration on load can be dropped: it is done here
  publishFacade(globalThis);
  const metadata = result.moduleMetadata ?? {};
  const props = result.props ?? {};
  class ForgebookStoryHost {
    [name: string]: unknown;
    constructor() {
      Object.assign(this, props);
    }
  }
  Component({
    selector: HOST_SELECTOR,
    template: result.template ?? "",
    imports: hostImports(result, component),
    providers: [...(metadata.providers ?? [])],
    styles: [...(result.styles ?? [])],
    schemas: [...(metadata.schemas ?? [])]
  })(ForgebookStoryHost);
  return ForgebookStoryHost;
};
