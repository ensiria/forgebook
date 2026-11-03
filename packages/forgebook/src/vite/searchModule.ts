/**
 * The modules that answer a group's search index: what the search reads that the tree does not hold, built at build time
 * and loaded by the page on the first search, so nobody who never searches pays for it.
 *
 * @remarks
 * A docs page's and a component's text come from the HTML the pages themselves are drawn from, so a heading's anchor here
 * is the one on the page by construction, and whatever a page renders is what is searched. Props come from the docs the
 * page reads too. Each stretch of text is kept whole, so a sentence is found and shown as written: it weighs little
 * next to the code, and repeats well under compression.
 *
 * @module
 */
import { readFileSync } from "node:fs";

import type { ComponentDocs } from "../componentDocs.ts";
import type { DocBlock } from "../docPages.ts";
import type { SearchComponent, SearchIndex, SearchProp, SearchSection } from "../searchIndex.ts";
import { componentPage } from "./componentPage.ts";
import { compiledDocPage } from "./docPageMarkdown.ts";
import { indexedDocPages } from "./docPagesModule.ts";
import type { DocsResult } from "./docsExtractor.ts";
import type { PackJson } from "./packedModule.ts";
import { type IndexedStoryFile, indexedStoryFiles } from "./storyFilesModule.ts";

/** A heading of the pages' HTML: its anchor, and what is inside it. */
const HEADING = /<h[1-6] id="doc-([^"]*)"[^>]*>([\s\S]*?)<\/h[1-6]>/g;

/** A tag: `>` inside a quoted attribute does not end it. */
const TAG = /<\/?([a-z][a-z0-9]*)(?:"[^"]*"|'[^']*'|[^'">])*>/gi;

/** The tags inside a line of text: taking one out joins what it wrote apart, as coloured code is. */
const INLINE_TAG = /^(a|abbr|b|code|del|em|i|kbd|mark|s|small|span|strong|sub|sup|u)$/i;

/** The entities the Markdown renderer writes, and the space a page writes by hand; `&amp;` comes last. */
const ENTITIES: readonly (readonly [string, string])[] = [
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&nbsp;", " "],
  ["&amp;", "&"]
];

/** HTML's text: its tags out, and what a comment or a raw `<style>` or `<script>` holds, which nobody reads. */
const plainText = (html: string): string => {
  const words = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(TAG, (_tag: string, name: string) => (INLINE_TAG.test(name) ? "" : " "))
    .replace(/\s+/g, " ")
    .replace(/ ([.,;:!?)])/g, "$1")
    .trim();
  const numbered = words.replace(/&#(\d+);/g, (_entity, code: string) => String.fromCodePoint(Number(code)));
  return ENTITIES.reduce((text, [entity, character]) => text.replaceAll(entity, character), numbered);
};

/**
 * HTML as stretches of documentation, one per heading that carries an anchor.
 *
 * @param html - the HTML.
 * @returns the stretches, those with neither a heading nor a text left out.
 */
export const htmlSections = (html: string): SearchSection[] => {
  const sections: SearchSection[] = [];
  let reached = 0;
  let open: Omit<SearchSection, "text"> = {};
  const close = (end: number): void => {
    const text = plainText(html.slice(reached, end));
    if (text !== "" || open.heading !== undefined) sections.push({ ...open, text });
  };
  for (const heading of html.matchAll(HEADING)) {
    close(heading.index);
    reached = heading.index + heading[0].length;
    open = { anchor: heading[1] ?? "", heading: plainText(heading[2] ?? "") };
  }
  close(html.length);
  return sections;
};

/**
 * A text added to the stretch it follows: a page's text goes on after a code block or a live story under the same
 * heading.
 *
 * @param sections - the stretches so far; the last one changes.
 * @param text - the text.
 */
const continueSection = (sections: SearchSection[], text: string): void => {
  const last = sections.pop();
  if (last === undefined) sections.push({ text });
  else sections.push({ ...last, text: `${last.text} ${text}`.trim() });
};

/**
 * A docs page's blocks as stretches of documentation, one per heading: a code block belongs to the heading above it.
 * A live story or an API table adds no text: what they show is found under its own name.
 *
 * @param blocks - the page's blocks.
 */
export const blockSections = (blocks: readonly DocBlock[]): SearchSection[] => {
  const sections: SearchSection[] = [];
  for (const block of blocks) {
    if (block.kind === "code") continueSection(sections, block.text.replace(/\s+/g, " ").trim());
    if (block.kind !== "text") continue;
    const [first, ...rest] = htmlSections(block.html);
    if (first?.heading === undefined && first !== undefined) continueSection(sections, first.text);
    else if (first !== undefined) sections.push(first);
    sections.push(...rest);
  }
  return sections;
};

/** Everything that is not an empty text, as one text. */
const joinedText = (texts: readonly (string | undefined)[]): string =>
  [...new Set(texts.filter((text) => text !== undefined && text !== ""))].join(" ");

/** What a component's docs say of it, the rule of when to use it included. */
const leadOf = ({ summary, description, guidance }: ComponentDocs): string =>
  joinedText([
    summary,
    description,
    ...(guidance?.useWhen ?? []),
    ...(guidance?.avoidWhen ?? []),
    guidance?.deprecated
  ]);

/** A list of a component's props as the index holds them. */
const propsOf = (props: ComponentDocs["props"], part: string | undefined): SearchProp[] =>
  props.map(({ name, description, kind }) => ({
    name,
    text: description,
    ...(part === undefined ? {} : { part }),
    ...(kind === "event" ? { isEvent: true } : {})
  }));

/**
 * What the page lists of a component, in the same terms: a hook's or a function's parameters, else its props, and its
 * parts with theirs.
 *
 * @param docs - the component's docs.
 * @param isLogic - whether its stories are about logic.
 */
const componentProps = (docs: ComponentDocs, isLogic: boolean): SearchProp[] => {
  const isCall = isLogic && docs.signature !== undefined;
  // the page draws no reference at all for a component with no props of its own, its parts' included
  if (!isCall && docs.props.length === 0) return [];
  return [
    ...(isCall
      ? (docs.signature?.parameters ?? []).map(({ name, description }) => ({ name, text: description }))
      : propsOf(docs.props, undefined)),
    ...docs.subcomponents.flatMap((subcomponent) => [
      { name: subcomponent.name, text: subcomponent.description },
      ...propsOf(subcomponent.props, subcomponent.name)
    ])
  ];
};

/** The fields of a component's entry that say something, so an empty one weighs nothing. */
const componentEntry = (
  docs: ComponentDocs | undefined,
  isLogic: boolean,
  sections: readonly SearchSection[]
): SearchComponent => {
  const lead = docs === undefined ? "" : leadOf(docs);
  const props = docs === undefined ? [] : componentProps(docs, isLogic);
  return {
    ...(lead === "" ? {} : { lead }),
    ...(props.length === 0 ? {} : { props }),
    ...(sections.length === 0 ? {} : { sections })
  };
};

/** Whether a story file's stories are all about logic: the page then documents its call, not its props. */
const isLogicFile = ({ index }: IndexedStoryFile): boolean =>
  index.stories.length > 0 && index.stories.every((story) => story.isLogic ?? index.isLogic ?? false);

/** Whether what a framework read is a component's docs. */
const isComponent = (docs: Exclude<DocsResult, string>["docs"]): docs is ComponentDocs => docs.name !== null;

/**
 * A component's entry and, when its docs cannot be read, why: its documentation file is searched either way.
 *
 * @param file - the story file.
 * @param read - what the framework read of its component.
 * @param watch - adds a file whose edit renews the module.
 */
const entryOf = (
  file: IndexedStoryFile,
  read: DocsResult,
  watch: (file: string) => void
): { readonly entry: SearchComponent; readonly problem?: string } => {
  const page = componentPage(file.file);
  if (page !== undefined) watch(page.file);
  const sections = page === undefined ? [] : htmlSections(page.html);
  if (typeof read === "string")
    return { entry: componentEntry(undefined, false, sections), problem: `${file.key}: ${read}` };
  if ("sources" in read) for (const source of read.sources) watch(source);
  const docs = isComponent(read.docs) ? read.docs : undefined;
  return { entry: componentEntry(docs, isLogicFile(file), sections) };
};

/**
 * A group of story files' search index, as the code of its module.
 *
 * @param root - the declaring module's folder.
 * @param pattern - the pattern.
 * @param watch - adds a file whose edit renews the module.
 * @param extract - reads a story file's component.
 * @param isServing - whether a dev server runs: only its tools read the problems, which name files on this computer, so
 * a static build leaves them out.
 * @param pack - writes the index's JSON as the module's value: as it is, or in a gzipped file of a build's own, which
 * few visits read.
 */
export const storySearchModule = async (
  root: string,
  pattern: string,
  watch: (file: string) => void,
  extract: (storyFile: string) => Promise<DocsResult>,
  isServing: boolean,
  pack: PackJson
): Promise<string> => {
  const files = indexedStoryFiles(root, pattern, watch);
  const entries = await Promise.all(
    files.map(async (file) => ({ file, ...entryOf(file, await extract(file.file), watch) }))
  );
  const problems = entries.flatMap(({ problem }) => problem ?? []);
  const index: SearchIndex = {
    components: Object.fromEntries(
      entries.filter(({ entry }) => Object.keys(entry).length > 0).map(({ file, entry }) => [file.key, entry])
    ),
    ...(problems.length === 0 || !isServing ? {} : { problems })
  };
  return `export default ${pack(JSON.stringify(index))};`;
};

/**
 * A group of docs pages' search index, as the code of its module.
 *
 * @param root - the declaring module's folder.
 * @param pattern - the pattern.
 * @param watch - adds a file whose edit renews the module.
 * @param pack - writes the index's JSON as the module's value.
 */
export const pagesSearchModule = (
  root: string,
  pattern: string,
  watch: (file: string) => void,
  pack: PackJson
): string => {
  const pages = indexedDocPages(root, pattern, watch).map(({ key, file }) => [
    key,
    blockSections(compiledDocPage(file, readFileSync(file, "utf8")).blocks)
  ]);
  return `export default ${pack(JSON.stringify({ pages: Object.fromEntries(pages) }))};`;
};
