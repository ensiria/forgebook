/**
 * A story file's index, read from its source without running it: the meta's title and the stories with their names,
 * as Forgebook's and Storybook's files write them.
 *
 * @remarks
 * The sidebar lists every story before any is loaded, so the index comes from the code itself, parsed with Vite's
 * parser (the same files Vite compiles). It reads a meta written inline or as a constant (`export default meta`,
 * `export { meta as default }`), `includeStories`, `excludeStories`, `__namedExportsOrder`, the meta's and the
 * stories' `tags`, the TSDoc above a story, and `parameters.docs.description`.
 *
 * Every named export the meta lets in is a story, as Storybook's indexer has it, whatever writes its value: an object
 * (CSF 3), a function with its properties assigned after it (CSF 2: `A.storyName`, `A.parameters`), a template bound
 * into a story, a helper's result (`makeStory(…)`), another constant (`export const B = A`), a re-export
 * (`export { A as B }`, from this file or another). The fields come from the object a value is or names, and from what
 * is assigned to the export; anything else is the frame's to read when the story loads. Only what does not exist when
 * the file runs is left out: `export type`, and `export *`, whose names Storybook does not list either.
 *
 * A value the index needs (the title, a name, `parameters.controls`, `group`, `height`, `main`, the meta's `alsoIn`,
 * `related`, `keywords`) is read when written plainly; written by code, it is left to the frame, which reads it when
 * the story loads. `touch`, `logic`, `design.figma` and the meta's `propGroups` are read by the index only, so written by
 * code they are a problem.
 * A `design.figma` is checked here too, so the pages never carry the checker: one that is not a link to a Figma file is
 * noted and left out, and the file keeps its stories. A title written by code, or none, is the file's path
 * (`autoTitle`, as Storybook's auto-title); one written by code is also noted, since the author meant another. A value written plainly but wrongly
 * (`controls: true`) is a problem. Pure: text in, index or problem out.
 *
 * @module
 */

import type { FigmaLink, StoryFileIndex, StoryIndexEntry } from "@forgebook/story-format/source";
import type { ESTree } from "vite";

import {
  controlsOf,
  designOf,
  docsDescription,
  type Fields,
  flagsOf,
  groupOf,
  heightOf,
  objectFields,
  parameter,
  propertyValue,
  propGroupsOf,
  stringField,
  stringListOf,
  unwrapped
} from "./indexFields.ts";
import { moduleName, type NamedExport, namedExports } from "./storyExports.ts";
import { parseStoryFile } from "./storyParse.ts";
import { playField } from "./storyPlay.ts";

/** What the index is given besides the file: the title its path makes, for a meta that writes none. */
export type IndexOptions = {
  /** The title from the file's path (`Inputs/Select`); none when the file's place gives none. */
  readonly autoTitle?: string;
};

/** A comment as the parser gives it. */
type SourceComment = {
  readonly type: string;
  readonly value: string;
  readonly start: number;
  readonly end: number;
};

/**
 * The first sentence of the TSDoc right above a statement, without its tags; `undefined` when there is none.
 *
 * @param text - the file's source.
 * @param comments - the file's comments.
 * @param start - where the statement starts.
 */
const leadingSentence = (
  text: string,
  comments: readonly SourceComment[],
  start: number
): string | undefined => {
  const comment = comments.find(
    (candidate) =>
      candidate.type === "Block" &&
      candidate.value.startsWith("*") &&
      candidate.end <= start &&
      text.slice(candidate.end, start).trim() === ""
  );
  if (comment === undefined) return undefined;
  const prose = comment.value
    .split("\n")
    .map((line) => line.replace(/^\s*\*?\s?/, ""))
    .filter((line) => !line.startsWith("@"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = /^(.+?[.!?])(\s|$)/.exec(prose)?.[1] ?? prose;
  return sentence === "" ? undefined : sentence;
};

/**
 * Tags as Storybook combines them: the meta's, then the story's, a `!name` taking `name` away.
 *
 * @param lists - the tag lists, outermost first.
 */
const combinedTags = (lists: readonly (readonly string[] | undefined)[]): readonly string[] => {
  const tags = new Set<string>();
  for (const tag of lists.flatMap((list) => list ?? [])) {
    if (tag.startsWith("!")) {
      tags.delete(tag.slice(1));
      tags.add(tag);
    } else {
      tags.delete(`!${tag}`);
      tags.add(tag);
    }
  }
  return [...tags];
};

/** What the index reads of one story besides its export. */
type StoryFields = Pick<
  StoryIndexEntry,
  "id" | "name" | "controls" | "group" | "height" | "design" | "isMain" | "isTouch" | "isLogic" | "tags"
>;

/**
 * A story's own design as the index keeps it: a refused link stays as `null`, since the story meant to replace the
 * meta's design, not to take it.
 *
 * @param design - the design, as `designOf` read it.
 */
const storyDesign = (design: FigmaLink | undefined | string): Pick<StoryIndexEntry, "design"> => {
  if (design === undefined) return {};
  return { design: typeof design === "string" ? null : design };
};

/**
 * What a story's own object and assignments say of who it is: its id (`parameters.__id`, read by Storybook only when
 * written plainly) and its name (`name`, or CSF 2's `storyName`).
 *
 * @param own - the story's own fields.
 */
const identityOf = (own: Fields): Pick<StoryIndexEntry, "id" | "name"> => {
  const name = stringField(own, "name") ?? stringField(own, "storyName");
  const id = parameter(own, "__id");
  return {
    ...(id?.type === "Literal" && typeof id.value === "string" ? { id: id.value } : {}),
    ...(name === undefined ? {} : { name })
  };
};

/**
 * What the index reads of one story: its own id (`parameters.__id`), its name (`name`, or CSF 2's `storyName`),
 * controls, group, height, design, whether it is the demo, and its tags under the meta's.
 *
 * @param fields - the story's fields: its own, for its name and id, and all it has, for the rest.
 * @param metaTags - the meta's tags.
 * @param notes - the file's notes, which a design left out adds to.
 */
const storyFields = (
  { own, fields }: StoryFieldSources,
  metaTags: readonly string[] | undefined,
  notes: string[]
): StoryFields | Error => {
  const controls = controlsOf(fields);
  if (controls instanceof Error) return controls;
  const group = groupOf(fields);
  if (group instanceof Error) return group;
  const height = heightOf(fields);
  if (height instanceof Error) return height;
  const design = designOf(fields);
  if (design instanceof Error) return design;
  if (typeof design === "string") notes.push(design);
  const ownTags = stringListOf(fields, "tags");
  if (ownTags instanceof Error) return ownTags;
  const tags = combinedTags([metaTags, ownTags]);
  const main = parameter(fields, "main");
  const flags = flagsOf(fields);
  if (flags instanceof Error) return flags;
  return {
    ...identityOf(own),
    ...(controls === undefined ? {} : { controls }),
    ...(group === undefined ? {} : { group }),
    ...(height === undefined ? {} : { height }),
    ...storyDesign(design),
    ...(main?.type === "Literal" && main.value === true ? { isMain: true } : {}),
    ...flags,
    ...(tags.length > 0 ? { tags } : {})
  };
};

/** The file's top level, read once: its constants and the properties assigned to names. */
type TopLevel = {
  /** Each constant's value, by name. */
  readonly values: ReadonlyMap<string, ESTree.Expression>;
  /** The properties assigned to a name after it (`A.storyName = "…"`), by name then property. */
  readonly assigned: ReadonlyMap<string, ReadonlyMap<string, ESTree.Expression>>;
};

/** A property assigned to a name at the top of the file (`A.storyName = "…"`). */
type AssignedProperty = {
  readonly name: string;
  readonly property: string;
  readonly value: ESTree.Expression;
};

/**
 * The property a top-level statement assigns to a name, when it assigns one.
 *
 * @param statement - the statement.
 */
const assignedProperty = (statement: ESTree.Program["body"][number]): AssignedProperty | undefined => {
  if (statement.type !== "ExpressionStatement") return undefined;
  const { expression } = statement;
  if (expression.type !== "AssignmentExpression" || expression.left.type !== "MemberExpression")
    return undefined;
  const { object, property } = expression.left;
  if (object.type !== "Identifier" || property.type !== "Identifier") return undefined;
  return { name: object.name, property: property.name, value: unwrapped(expression.right) };
};

/** A constant declared at the top of the file, with its value. */
type Declared = { readonly name: string; readonly value: ESTree.Expression };

/**
 * The constants a top-level statement declares with a value, exported or not.
 *
 * @param statement - the statement.
 */
const declaredBy = (statement: ESTree.Program["body"][number]): Declared[] => {
  const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
  if (declaration?.type !== "VariableDeclaration") return [];
  return declaration.declarations.flatMap(({ id, init }): Declared[] =>
    id.type === "Identifier" && init !== null ? [{ name: id.name, value: unwrapped(init) }] : []
  );
};

/**
 * The file's top level: its constants, exported or not, and the properties assigned to names.
 *
 * @param program - the parsed file.
 */
const topLevelOf = (program: ESTree.Program): TopLevel => {
  const values = new Map<string, ESTree.Expression>();
  const assigned = new Map<string, Map<string, ESTree.Expression>>();
  for (const statement of program.body) {
    for (const declared of declaredBy(statement)) values.set(declared.name, declared.value);
    const property = assignedProperty(statement);
    if (property === undefined) continue;
    const properties = assigned.get(property.name) ?? new Map<string, ESTree.Expression>();
    properties.set(property.property, property.value);
    assigned.set(property.name, properties);
  }
  return { values, assigned };
};

/**
 * The object a value is, or the one the constants it names lead to (`export const B = A`); `undefined` for any other
 * value, or for names that lead back to themselves.
 *
 * @param top - the file's top level.
 * @param value - the value.
 * @param seen - the names followed so far.
 */
const objectOf = (
  top: TopLevel,
  value: ESTree.Expression | undefined,
  seen: ReadonlySet<string> = new Set()
): ESTree.ObjectExpression | undefined => {
  if (value?.type === "ObjectExpression") return value;
  if (value?.type !== "Identifier" || seen.has(value.name)) return undefined;
  return objectOf(top, top.values.get(value.name), new Set([...seen, value.name]));
};

/**
 * Where a story's fields are read: its own (what is assigned to it, and the object its export declares in place), which
 * give its name and id, as Storybook's indexer reads them; and all it has, the object another constant holds too,
 * which give the rest, since the story is that object when the file runs.
 */
type StoryFieldSources = {
  /** Its own fields. */
  readonly own: Fields;
  /** All its fields. */
  readonly fields: Fields;
};

/**
 * A story's fields, by the export that names it: what is assigned to it after its declaration (`A.storyName = "…"`),
 * else the object its value is or names. A story from another file has none.
 *
 * @param top - the file's top level.
 * @param named - the export.
 */
const storyFieldsOf = (top: TopLevel, named: NamedExport): StoryFieldSources => {
  const { local } = named;
  if (local === undefined) return { own: () => undefined, fields: () => undefined };
  const assigned = top.assigned.get(local);
  const value = top.values.get(local);
  const declared = named.isDeclared && value?.type === "ObjectExpression" ? value : undefined;
  const object = objectOf(top, value);
  const read =
    (from: ESTree.ObjectExpression | undefined) =>
    (name: string): ESTree.Expression | undefined =>
      assigned?.get(name) ?? (from === undefined ? undefined : propertyValue(from, name));
  return { own: read(declared), fields: read(object) };
};

/**
 * Whether an export is a story, as the meta's `includeStories` and `excludeStories` say (a list of names or a regular
 * expression, written plainly).
 *
 * @param meta - the meta's fields.
 * @param exportName - the export.
 */
const isIncluded = (meta: Fields, exportName: string): boolean => {
  const matches = (name: string): boolean | undefined => {
    const filter = meta(name);
    if (filter?.type === "ArrayExpression")
      return filter.elements.some((element) => element?.type === "Literal" && element.value === exportName);
    if (filter?.type === "Literal" && "regex" in filter && filter.regex !== undefined)
      return new RegExp(filter.regex.pattern, filter.regex.flags).test(exportName);
    return undefined;
  };
  return matches("includeStories") !== false && matches("excludeStories") !== true;
};

/**
 * The order `__namedExportsOrder` writes, when the file writes one plainly.
 *
 * @param top - the file's top level.
 */
const exportsOrder = (top: TopLevel): readonly string[] | undefined => {
  const order = top.values.get("__namedExportsOrder");
  if (order?.type !== "ArrayExpression") return undefined;
  return order.elements.flatMap((element) =>
    element?.type === "Literal" && typeof element.value === "string" ? [element.value] : []
  );
};

/**
 * The meta exported by name (`export { meta as default }`), when it is a constant of the file written as an object.
 *
 * @param program - the parsed file.
 * @param top - the file's top level.
 */
const namedMeta = (program: ESTree.Program, top: TopLevel): ESTree.ObjectExpression | undefined => {
  for (const statement of program.body) {
    if (statement.type !== "ExportNamedDeclaration" || statement.source !== null) continue;
    const specifier = statement.specifiers.find((each) => moduleName(each.exported) === "default");
    if (specifier === undefined) continue;
    const value = top.values.get(moduleName(specifier.local));
    return value?.type === "ObjectExpression" ? value : undefined;
  }
  return undefined;
};

/**
 * The meta's object: the default export, inline or a constant of the file (`export default meta`,
 * `export { meta as default }`).
 *
 * @param program - the parsed file.
 * @param top - the file's top level.
 */
const metaObject = (program: ESTree.Program, top: TopLevel): ESTree.ObjectExpression | undefined => {
  const meta = program.body.find((statement) => statement.type === "ExportDefaultDeclaration");
  if (meta === undefined) return namedMeta(program, top);
  const { declaration } = meta;
  if (
    declaration.type === "FunctionDeclaration" ||
    declaration.type === "ClassDeclaration" ||
    declaration.type === "TSInterfaceDeclaration"
  )
    return undefined;
  const expression = unwrapped(declaration);
  const value = expression.type === "Identifier" ? top.values.get(expression.name) : expression;
  return value?.type === "ObjectExpression" ? value : undefined;
};

/**
 * A story file's meta object, as the index reads it: inline or a constant of the file, exported by default or by name.
 *
 * @param program - the parsed file.
 */
export const storyFileMeta = (program: ESTree.Program): ESTree.ObjectExpression | undefined =>
  metaObject(program, topLevelOf(program));

/** The meta's lists of plain strings, each only when it sets it. */
type MetaLists = Pick<StoryFileIndex, "alsoIn" | "related" | "keywords">;

/** The meta's lists of plain strings (`alsoIn`, `related`, `keywords`), each only when set, or the first problem. */
const metaListsOf = (meta: Fields): MetaLists | Error => {
  const lists: { -readonly [Name in keyof MetaLists]: MetaLists[Name] } = {};
  for (const name of ["alsoIn", "related", "keywords"] as const) {
    const list = stringListOf(meta, name);
    if (list instanceof Error) return list;
    if (list !== undefined) lists[name] = list;
  }
  return lists;
};

/**
 * The meta's title and the note to give with it: the title written plainly; the file's path for none; the path, with
 * a note, for a title written by code.
 *
 * @param meta - the meta's fields.
 * @param options - the title the file's path makes.
 */
const titleOf = (
  meta: Fields,
  options: IndexOptions
): { readonly title: string; readonly notes: readonly string[] } | string => {
  const written = meta("title");
  if (written?.type === "Literal" && typeof written.value === "string")
    return { title: written.value, notes: [] };
  if (options.autoTitle === undefined)
    return "the meta's title must be a plain string (or the file must sit where its path makes one)";
  if (written === undefined) return { title: options.autoTitle, notes: [] };
  return {
    title: options.autoTitle,
    notes: [`its title is written by code, so it is placed by its path as "${options.autoTitle}"`]
  };
};

/** The meta's fields besides its title and stories, each only when set. */
type MetaFields = Pick<
  StoryFileIndex,
  "id" | "controls" | "height" | "design" | "alsoIn" | "related" | "keywords" | "propGroups" | "description"
>;

/**
 * The meta's design as the index keeps it: a link that is not a Figma file's is noted and left out.
 *
 * @param meta - the meta's fields.
 * @param notes - the file's notes, which a design left out adds to.
 */
const metaDesign = (meta: Fields, notes: string[]): Pick<StoryFileIndex, "design"> | Error => {
  const design = designOf(meta);
  if (design instanceof Error) return design;
  if (typeof design === "string") {
    notes.push(design);
    return {};
  }
  return design === undefined ? {} : { design };
};

/**
 * The meta's fields besides its title and stories (its `id` among them), or the first problem.
 *
 * @param meta - the meta's fields.
 * @param notes - the file's notes, which a design left out adds to.
 */
const metaFieldsOf = (meta: Fields, notes: string[]): MetaFields | Error => {
  const id = meta("id");
  // Storybook refuses a component id written by code: it would give ids no link can know
  if (id !== undefined && (id.type !== "Literal" || typeof id.value !== "string"))
    return new Error("`id` must be a plain string");
  const controls = controlsOf(meta);
  if (controls instanceof Error) return controls;
  const height = heightOf(meta);
  if (height instanceof Error) return height;
  const design = metaDesign(meta, notes);
  if (design instanceof Error) return design;
  const lists = metaListsOf(meta);
  if (lists instanceof Error) return lists;
  const propGroups = propGroupsOf(meta);
  if (propGroups instanceof Error) return propGroups;
  const description = docsDescription(meta, "component");
  const flags = flagsOf(meta);
  if (flags instanceof Error) return flags;
  return {
    // an empty id is none, as Storybook's `meta.id || meta.title` has it
    ...(id === undefined || id.value === "" ? {} : { id: String(id.value) }),
    ...(controls === undefined ? {} : { controls }),
    ...(height === undefined ? {} : { height }),
    ...design,
    ...flags,
    ...lists,
    ...(propGroups === undefined ? {} : { propGroups }),
    ...(description === undefined ? {} : { description })
  };
};

/**
 * The exports that are stories, in the order of `__namedExportsOrder` when the file writes one, else of the file.
 *
 * @param program - the parsed file.
 * @param top - the file's top level.
 * @param meta - the meta's fields, for `includeStories` and `excludeStories`.
 */
const storyExports = (program: ESTree.Program, top: TopLevel, meta: Fields): NamedExport[] => {
  const exported = namedExports(program).filter(
    ({ exportName }) => exportName !== "__namedExportsOrder" && isIncluded(meta, exportName)
  );
  const order = exportsOrder(top);
  if (order === undefined) return exported;
  const rank = (name: string): number => (order.includes(name) ? order.indexOf(name) : order.length);
  return [...exported].sort((first, second) => rank(first.exportName) - rank(second.exportName));
};

/**
 * The index of one story file.
 *
 * @param file - the file's path, for the parser (its extension decides TypeScript and JSX) and the messages.
 * @param text - the file's source.
 * @param options - the title the file's path makes, for a meta that writes none.
 * @returns the title and the stories, or a message saying why the file cannot be indexed.
 */
export const indexStoryFile = (
  file: string,
  text: string,
  options: IndexOptions = {}
): StoryFileIndex | string => {
  const { program, comments, errors } = parseStoryFile(file, text);
  const [error] = errors;
  if (error !== undefined) return `${file} does not parse: ${error.message}`;
  const top = topLevelOf(program);
  const metaNode = metaObject(program, top);
  if (metaNode === undefined) return `${file} has no meta: the default export is an object (CSF)`;
  const meta = objectFields(metaNode);
  const title = titleOf(meta, options);
  if (typeof title === "string") return `${file}: ${title}`;
  const metaTags = stringListOf(meta, "tags");
  if (metaTags instanceof Error) return `${file}: the meta's ${metaTags.message}`;
  const stories: StoryIndexEntry[] = [];
  const storyNotes: string[] = [];
  for (const named of storyExports(program, top, meta)) {
    const { exportName, start } = named;
    const sources = storyFieldsOf(top, named);
    const ownNotes: string[] = [];
    const fields = storyFields(sources, metaTags, ownNotes);
    if (fields instanceof Error) return `${file}: story ${exportName}: ${fields.message}`;
    storyNotes.push(...ownNotes.map((note) => `story ${exportName}: ${note}`));
    const description = leadingSentence(text, comments, start) ?? docsDescription(sources.fields, "story");
    const played = playField(named.local, top, meta("play"));
    stories.push({ exportName, ...fields, ...(description === undefined ? {} : { description }), ...played });
  }
  const metaNotes: string[] = [];
  const metaFields = metaFieldsOf(meta, metaNotes);
  if (metaFields instanceof Error) return `${file}: the meta's ${metaFields.message}`;
  const notes = [...title.notes, ...metaNotes, ...storyNotes];
  return {
    title: title.title,
    stories,
    ...metaFields,
    ...(notes.length > 0 ? { notes } : {})
  };
};
