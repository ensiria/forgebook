/**
 * The content an Angular component's template projects, each `<ng-content>` as the arg that fills it: read from the
 * template its decorator writes or the file its `templateUrl` names, never compiled.
 *
 * @remarks
 * Angular reads `<ng-content>` only where a template writes it, so the template's text says it all; a commented one is
 * left out. The default content (no `select`, or `*`) is `#default`, any other `#<selector>` as written.
 *
 * @module
 */
import { dirname, resolve } from "node:path";

import type { PropDocs } from "forgebook/component-docs";
import ts from "typescript-6";

import { argOfContent } from "../slotArgs.ts";
import { classMetadata, propertyOf, textOf } from "./classDecorators.ts";

/** A component's template: written in its decorator, or in the file `templateUrl` names. */
type TemplateText = { readonly text: string; readonly file: string | undefined };

/**
 * A component's template.
 *
 * @param node - the class.
 */
export const templateOf = (node: ts.ClassDeclaration): TemplateText | undefined => {
  const metadata = classMetadata(node);
  const inline = textOf(propertyOf(metadata, "template"));
  if (inline !== undefined) return { text: inline, file: undefined };
  const url = textOf(propertyOf(metadata, "templateUrl"));
  if (url === undefined) return undefined;
  const file = resolve(dirname(node.getSourceFile().fileName), url);
  const text = ts.sys.readFile(file);
  return text === undefined ? undefined : { text, file };
};

/**
 * The selectors of the content a template projects, each once, in its order: none for `<ng-content>` alone.
 *
 * @param template - the template's text.
 */
export const contentSelectors = (template: string): (string | undefined)[] => {
  // read in one pass, as a parser reads it: a comment is skipped where it starts, so what it holds is never a tag
  const tags = [...template.matchAll(/<!--[\s\S]*?(?:-->|$)|<ng-content\b([^>]*)>/g)].filter(
    (match) => !match[0].startsWith("<!--")
  );
  const selectors = tags.map((match) => {
    const select = /\bselect\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(match[1] ?? "");
    const selector = select?.[1] ?? select?.[2];
    return selector === undefined || selector.trim() === "*" ? undefined : selector.trim();
  });
  return [...new Set(selectors)];
};

/**
 * One projected content's docs, as the arg that fills it.
 *
 * @param selector - its selector; none for the default.
 */
export const contentDocs = (selector: string | undefined): PropDocs => ({
  name: argOfContent(selector),
  kind: "other",
  type: selector === undefined ? "ng-content" : `ng-content select="${selector}"`,
  description: "",
  isRequired: false,
  canTakeText: true
});
