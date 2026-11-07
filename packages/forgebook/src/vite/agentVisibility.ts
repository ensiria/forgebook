/**
 * Whether an agent can see a published component: what `verify` holds a changed one to, and `forgebook visibility` every
 * one.
 *
 * @remarks
 * Pure. An agent looks a component up by its words and reads it through its stories (`find`, `story`), so a component
 * nothing there names is rebuilt instead of reused, as has happened with a component only other components' stories drew.
 * Four things hide one, each with its fix: no story of its own, stories all tagged `!dev`, stories whose meta names no
 * component or a component whose docs have no props (the props table is what an agent writes against), and no TSDoc.
 * `keywords` are not asked for: a good title finds most components, and a check nearly every project fails is turned off.
 * A part (`DialogTrigger`, in a file of its own) that the stories of the component it is named after reach is seen on that
 * page, as `subcomponents` shows it. A provider draws nothing of its own to look at, so no story is owed for it.
 *
 * @module
 */
import { shellWord } from "../shellWord.ts";
import type { UnseenComponent, UnseenReason, VisibilityDocument } from "./agent.types.ts";
import type { PublishedFile } from "./publishedExports.ts";

/** A catalogue's component as this reads it. */
export type SeenComponent = {
  /** Its whole title. */
  readonly title: string;
  /** Its first story file, relative to the catalogue: what a fix names. */
  readonly storyFile: string;
  /** How many of its stories are listed. */
  readonly listed: number;
  /** How many are tagged `!dev`. */
  readonly unlisted: number;
  /** The names of its stories and the words its meta declares: what a search reads. */
  readonly words: readonly string[];
  /** The file its meta's `component` is declared in; none when its meta names none. */
  readonly metaFile: string | undefined;
  /** The files its stories reach. */
  readonly reached: readonly string[];
  /** Its story files' text: what names a part when the graph cannot follow a JavaScript library's imports. */
  readonly storyText: string;
  /** The docs its meta's component has; none when none could be read. */
  readonly docs:
    | {
        /** How many props they list. */
        readonly props: number;
        /** Whether they hold its TSDoc, or its file's. */
        readonly hasText: boolean;
        /** The names of the parts its meta lists. */
        readonly subcomponents: readonly string[];
      }
    | undefined;
  /** The meta's `parameters.docs.description.component`, which an agent reads as it reads TSDoc. */
  readonly description: string | undefined;
};

/** A component that only hands something to what it wraps. */
const DRAWS_NOTHING = /(?:Provider|Context|Consumer)$/;

/** A name with what does not change its reading taken off: `date-picker`, `DatePicker` and `Date Picker` are one. */
const plainName = (name: string): string => name.replace(/[^A-Za-z0-9]/g, "").toLowerCase();

/** The name a file goes by. */
const fileStem = (file: string): string => {
  const parts = file.split("/");
  const name = (parts.at(-1) ?? "").replace(/\.[^.]+$/, "");
  return name === "index" ? (parts.at(-2) ?? name) : name;
};

/**
 * Whether a meta's component is a published file: the same file, or the declaration of it. A JavaScript library declares
 * its types beside its code, and a package whose types point at its build leads the checker into that build, so a meta's
 * component may be `Box/index.d.ts` or `dist/Button.d.ts` and not the source.
 */
const isMetaOf = (metaFile: string | undefined, file: string): boolean => {
  if (metaFile === file) return true;
  if (metaFile === undefined || !/\.d\.[cm]?ts$/.test(metaFile)) return false;
  const folderOf = (path: string): string => path.split("/").slice(0, -1).join("/");
  const isBeside = folderOf(metaFile) === folderOf(file);
  const isBuilt = /\/(?:dist|build|lib|es|esm|cjs)\//.test(metaFile);
  return (isBeside || isBuilt) && fileStem(metaFile.replace(/\.d(\.[cm]?ts)$/, "$1")) === fileStem(file);
};

/** The plain names a search finds a component by: its title's parts, its stories' names, its meta's words. */
const namesOf = (component: SeenComponent): readonly string[] =>
  [...component.title.split("/"), ...component.words].map(plainName);

/**
 * Whether a component's stories draw another file of a published file's name: another package's component of that name
 * is then what they are about. The graph may not reach a JavaScript library's files at all, so what it does not reach
 * says nothing. An index only leads to the file it names, and a form with no extension is an import it did not resolve.
 */
const drawsAnother = (component: SeenComponent, published: PublishedFile): boolean => {
  if (component.reached.includes(published.file)) return false;
  const stem = plainName(fileStem(published.file));
  return component.reached.some(
    (file) => /\.[^/]+$/.test(file) && !/\/index\.[^/]+$/.test(file) && plainName(fileStem(file)) === stem
  );
};

/** Whether a component's stories are about a published file: its meta names it, or a search finds it there by name. */
const isAbout = (component: SeenComponent, published: PublishedFile): boolean => {
  if (isMetaOf(component.metaFile, published.file)) return true;
  if (drawsAnother(component, published)) return false;
  const names = namesOf(component);
  const wanted = [...published.names, fileStem(published.file)].map(plainName);
  if (wanted.some((name) => names.includes(name))) return true;
  // a story named `DefaultIssueLabelToken` is what a search for the token finds
  const storyNames = component.words.map(plainName);
  return wanted.some((name) => name.length > 3 && storyNames.some((each) => each.includes(name)));
};

/**
 * Whether a component's stories reach a published file, in any of the forms the graph writes an import it could not
 * resolve further (`components/Text`, `components/Text/index`).
 */
const isReached = (component: SeenComponent, file: string): boolean => {
  const bare = file.replace(/\.[^./]+$/, "");
  const folder = file.split("/").slice(0, -1).join("/");
  return [file, bare, folder, `${folder}/index`].some((form) => component.reached.includes(form));
};

/** Whether a story file's text uses a name as a word. */
const mentions = (text: string, name: string): boolean =>
  new RegExp(`(?<![\\w$])${name.replace(/[^\w$]/g, "")}(?![\\w$])`).test(text);

/**
 * Whether a published file is a part of a component: its meta lists it, or its stories use it and its name extends the
 * component's (`DialogTrigger` of `Dialog`) or is the one item of a plural (`Tab` of `Tabs`). The name alone would call
 * `ButtonGroup` seen on `Button`'s page, with nothing there showing it.
 */
const isPartOf = (component: SeenComponent, published: PublishedFile): boolean => {
  if (published.names.some((name) => component.docs?.subcomponents.includes(name) === true)) return true;
  // a title's first part is a section (`Controls`), and its last may be a variation (`Table/Simple`)
  const titles = component.title
    .split("/")
    .slice(1)
    .map(plainName)
    .filter((title) => title !== "");
  return published.names.some((name) => {
    const plain = plainName(name);
    const isNamedAfter = titles.some((title) => plain.startsWith(title) || title === `${plain}s`);
    return isNamedAfter && (isReached(component, published.file) || mentions(component.storyText, name));
  });
};

/** What hides a published file whose stories are about it. */
const reasonsAbout = (
  published: PublishedFile,
  path: string,
  own: readonly SeenComponent[]
): readonly UnseenReason[] => {
  const name = published.names[0] ?? fileStem(published.file);
  const first = own[0];
  if (first === undefined) return [];
  const reasons: UnseenReason[] = [];
  if (own.every((each) => each.listed === 0))
    reasons.push({
      missing: "listed-story",
      reason: `every story of ${first.title} is tagged !dev, so a search gives no story to open`,
      fix: `take !dev off a story in ${first.storyFile}`
    });
  const named = own.filter((each) => isMetaOf(each.metaFile, published.file));
  if (named.length === 0)
    reasons.push({
      missing: "props",
      reason: `the meta in ${first.storyFile} names no component, so an agent reads no props`,
      fix: `add component: ${name} to the meta in ${first.storyFile}`
    });
  else if (published.takesProps && named.every((each) => each.docs !== undefined && each.docs.props === 0))
    reasons.push({
      missing: "props",
      reason: `${name} takes props, and none could be read from its types`,
      fix: `give ${name} a props type declared in its package, in ${path}`
    });
  const hasText =
    published.hasComment ||
    own.some((each) => each.docs?.hasText === true || (each.description ?? "") !== "");
  // with no docs read there is no telling: naming the component in the meta comes first, then this says
  if (!hasText && named.some((each) => each.docs !== undefined))
    reasons.push({
      missing: "tsdoc",
      reason: `${name} has no TSDoc, so an agent cannot tell what it is for`,
      fix: `write a TSDoc comment on ${name} in ${path}`
    });
  return reasons;
};

/**
 * What hides a published file from an agent; none when it can be seen.
 *
 * @param published - the file, with the components it declares.
 * @param path - the file as a command names it, relative to the catalogue.
 * @param file - the file as a person names it, relative to the repository.
 * @param components - the catalogue's components.
 */
export const unseenComponent = (
  published: PublishedFile,
  path: string,
  file: string,
  components: readonly SeenComponent[]
): UnseenComponent | undefined => {
  const name = published.names[0] ?? fileStem(published.file);
  const own = components.filter((each) => isAbout(each, published));
  if (own.length === 0 && components.some((each) => isPartOf(each, published))) return undefined;
  if (own.length === 0 && published.names.every((each) => DRAWS_NOTHING.test(each))) return undefined;
  const reasons: readonly UnseenReason[] =
    own.length === 0
      ? [
          {
            missing: "story",
            reason: `no story is about ${name}, so a search for it finds nothing`,
            fix: `npx forgebook new ${shellWord(path)}`
          }
        ]
      : reasonsAbout(published, path, own);
  return reasons.length === 0 ? undefined : { file, component: name, reasons };
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Whether a value is the answer on what agents cannot see, as a client receives it over HTTP.
 *
 * @param value - the answer's body.
 */
export const isVisibilityDocument = (value: unknown): value is VisibilityDocument =>
  isRecord(value) &&
  value["schema"] === 1 &&
  Array.isArray(value["packages"]) &&
  Array.isArray(value["unseen"]) &&
  Array.isArray(value["skipped"]);
