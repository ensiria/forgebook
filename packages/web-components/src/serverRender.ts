/**
 * A Web Components story drawn as HTML on the server, with Lit's server renderer (`@lit-labs/ssr`): its templates, and
 * the Lit elements in them with their shadow roots written as declarative shadow DOM. Loaded only by the renderer's
 * `renderToString`, so no page ever loads it.
 *
 * @remarks
 * Only what Lit renders can be rendered on a server. An element that is not a Lit element is written with its attributes
 * and light DOM, its shadow root left to the browser, as Lit's renderer does. A render that returns a DOM node fails,
 * since a server has no DOM, and so does a component that reads `document` while it renders: the generated server tests
 * then say which story cannot. A story with no render is its element written as a template, with its attributes and its
 * slots, a list as JSON as the code writer writes it; a property (`.items`) has no place in HTML, so it is not on the
 * server's HTML.
 *
 * `@lit-labs/ssr` is an optional peer: the server tests need it, a catalogue does not. The renderer imports this module
 * by its package name, which no bundler follows, so a page never meets Lit's server renderer, which runs on Node only.
 * That is the only reason it is an export of the package: it is the renderer's, not an API of its own.
 *
 * @module
 */
import { render } from "@lit-labs/ssr";
import { collectResult } from "@lit-labs/ssr/lib/render-result.js";
import type { StoryDrawing } from "forgebook/renderer";
import { storyContextOf } from "forgebook/renderer";
import { html as staticHtml, unsafeStatic } from "lit/static-html.js";

import { argTarget, isAttributeName } from "./argNames.ts";
import { elementTag } from "./elementTag.ts";
import { slotsContent } from "./slotContent.ts";
import { storyContent } from "./storyContent.ts";

/** A text inside a double-quoted attribute. */
const attributeText = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/**
 * An attribute as the element's markup writes it: a text or a number quoted and escaped, `true` the bare name; none for
 * an arg that is no attribute, a name HTML cannot write, or a value an attribute does not hold.
 *
 * @param name - the arg's name.
 * @param value - its value.
 */
const attributeMarkup = (name: string, value: unknown): string[] => {
  const target = argTarget(name);
  if (target.kind !== "attribute" || !isAttributeName(target.name)) return [];
  if (value === true) return [target.name];
  if (typeof value === "string" || typeof value === "number")
    return [`${target.name}="${attributeText(String(value))}"`];
  // a list as JSON, as the code writer writes it and Lit's `Array` converter reads it
  return Array.isArray(value) ? [`${target.name}="${attributeText(JSON.stringify(value))}"`] : [];
};

/**
 * The meta's element with these args, as a template: its tag and attributes written in its markup, each one's name
 * checked and value escaped, since they are joined into the template's own text; its slots' content as values.
 *
 * @param component - the meta's component.
 * @param args - the args.
 * @throws when the component names no element.
 */
const elementTemplate = (component: unknown, args: Readonly<Record<string, unknown>>): unknown => {
  const found = elementTag(component);
  if ("problem" in found) throw new Error(found.problem);
  const attributes = Object.entries(args).flatMap(([name, value]) => attributeMarkup(name, value));
  const opening = unsafeStatic([found.tag, ...attributes].join(" "));
  return staticHtml`<${opening}>${slotsContent(args)}</${unsafeStatic(found.tag)}>`;
};

/**
 * The story's HTML, for the renderer's `renderToString`; internal to the package.
 *
 * @param drawing - the story, its args, texts, clock and language.
 * @returns the HTML; rejects with what the story or an element throws while it renders.
 */
export const renderStoryToString = async (drawing: StoryDrawing): Promise<string> => {
  const context = storyContextOf(drawing, drawing.args, () => document.body);
  const content = storyContent(drawing.story, context, drawing.decorators, () =>
    elementTemplate(drawing.story.component, drawing.args)
  );
  return collectResult(render(content));
};
