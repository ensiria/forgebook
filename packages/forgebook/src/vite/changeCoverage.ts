/**
 * Which changed files a person sees, and which stories show them: what `verify` holds a change to.
 *
 * @remarks
 * Pure. A UI file is a component or a style sheet, by its extension, and a story file; a plain script is one only when
 * its text defines or draws a component, since most scripts are logic a change may touch freely, and a script a story
 * reaches is checked by that story anyway. Tests, type declarations and what a tool wrote are not. A file reached through
 * another component's stories counts as covered, and says so: a private part rarely has stories of its own, and they run
 * it. A file only another catalogue of the repository can answer for is named and neither passes nor fails; any other
 * file nothing reaches is this catalogue's to fail, or a component in a package beside it would pass unseen.
 *
 * @module
 */
import type { ChangedUiFile, UiFileCoverage } from "./agent.types.ts";
import { CHECKED_FILE } from "./checkCode.ts";
import type { ReachedStory } from "./storyReach.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** A story file, in any framework's extension; a snapshot of one is not. */
const STORY_FILE = /\.stories\.(?:[cm]?[jt]sx?|vue|svelte|astro)$/;

/** A test's file or helper, wherever it sits. */
const TEST_FILE =
  /(?:\.test\.|\.spec\.|\.e2e\.|\.cy\.|_test\.|(?:^|\/)(?:__tests__|__mocks__|__snapshots__|e2e|cypress)\/|(?:^|\/)test-?utils\.)/;

/** A folder of tests; under `src` a folder of that name is as likely a feature. */
const TESTS_FOLDER = /(?:^|\/)tests?\//;

/** What is under `src`. */
const UNDER_SRC = /(?:^|\/)src\//;

/** What is written by a tool, or only types: nobody sees it change. */
const NOT_SEEN = /(?:\.d\.[cm]?ts$|\.min\.|(?:^|\/)(?:dist|generated|node_modules)\/)/;

/** Components and sheets `check-code` does not read for values, and an Angular component's files. */
const OTHER_UI_FILE = /(?:\.component\.(?:ts|html)|\.(?:css|styles?)\.[cm]?[jt]s|\.(?:pcss|postcss|styl))$/;

/** A plain script. */
const SCRIPT_FILE = /\.[cm]?[jt]s$/;

/** A script's text that defines a component: a custom element, an Angular component, a Vue one, a tagged template. */
const DEFINES_COMPONENT =
  /\bcustomElements\.define\(|@customElement\(|\bextends\s+(?:LitElement|HTMLElement)\b|@Component\(|\bdefineComponent\(|(?<![\w./-])html`/;

/** A JavaScript file, which may hold JSX with no extension to say so; TypeScript cannot without `.tsx`. */
const PLAIN_JAVASCRIPT = /\.[cm]?js$/;

/** JSX in a file's text: a closing tag, or a component closed on itself. */
const DRAWS_JSX = /<\/[A-Za-z][\w.-]{0,80}>|<[A-Z][\w.]{0,80}[^<>\n]{0,500}\/>/;

/**
 * Whether a changed file is one a person sees.
 *
 * @param file - the file, relative to the repository.
 * @param readText - its text; a plain script's is read to tell whether it defines a component.
 */
export const isUiFile = (file: string, readText: (file: string) => string): boolean => {
  if (TEST_FILE.test(file) || NOT_SEEN.test(file)) return false;
  if (TESTS_FOLDER.test(file) && !UNDER_SRC.test(file)) return false;
  if (STORY_FILE.test(file) || CHECKED_FILE.test(file) || OTHER_UI_FILE.test(file)) return true;
  if (!SCRIPT_FILE.test(file)) return false;
  const text = readText(file);
  return DEFINES_COMPONENT.test(text) || (PLAIN_JAVASCRIPT.test(file) && DRAWS_JSX.test(text));
};

/** A story with its id, as the catalogue lists it. */
export type IdentifiedStory = {
  /** Its id. */
  readonly id: string;
  /** What it reaches. */
  readonly reach: ReachedStory;
};

/**
 * The forms a deleted file can have left in the graph: what still imports it wrote it with no extension, or by its
 * folder.
 *
 * @param file - the deleted file, absolute.
 */
export const deletedForms = (file: string): readonly string[] => {
  const bare = file.replace(/\.[^./]+$/, "");
  return [file, bare, ...(bare.endsWith("/index") ? [bare.slice(0, -"/index".length)] : [])];
};

/**
 * How a changed file is covered.
 *
 * @param forms - the file's forms in the graph.
 * @param stories - the catalogue's stories.
 * @param everyStory - whether every story shows it: the catalogue's preview and its sheets.
 */
const coverageOf = (
  forms: readonly string[],
  stories: readonly IdentifiedStory[],
  everyStory: boolean
): { readonly coverage: UiFileCoverage; readonly stories: readonly string[] } => {
  const reaching = everyStory
    ? stories
    : stories.filter(({ reach }) => forms.some((form) => reach.files.includes(form)));
  // what every story shows is none's own, though a story may name it
  const isOwn = !everyStory && reaching.some(({ reach }) => forms.some((form) => reach.own.includes(form)));
  const covering: UiFileCoverage = isOwn ? "own" : "through";
  return { coverage: reaching.length === 0 ? "none" : covering, stories: reaching.map(({ id }) => id) };
};

/**
 * The changed files a story can show: what every story shows is none of them while the catalogue has no story, as a
 * catalogue just set up has its preview and nothing yet that shows it.
 *
 * @param files - the changed files.
 * @param stories - the catalogue's stories.
 * @param everyStoryFiles - the files every story shows.
 */
const shownFiles = <File extends { readonly absolute: string }>(
  files: readonly File[],
  stories: readonly IdentifiedStory[],
  everyStoryFiles: ReadonlySet<string>
): readonly File[] =>
  stories.length > 0 ? files : files.filter(({ absolute }) => !everyStoryFiles.has(absolute));

/** What `changedUiFiles` reads. */
export type UiFilesInput = {
  /** The files that changed, with their forms in the graph, relative to the repository and to the catalogue. */
  readonly files: readonly {
    readonly file: string;
    readonly path: string;
    readonly absolute: string;
    readonly isDeleted: boolean;
  }[];
  /** The catalogue's stories. */
  readonly stories: readonly IdentifiedStory[];
  /** The files every story shows. */
  readonly everyStoryFiles: ReadonlySet<string>;
  /** Whether a file, in the graph's form, belongs to another catalogue of the repository. */
  readonly isOtherCatalogues: (absolute: string) => boolean;
  /** Reads a file by its path relative to the repository. */
  readonly readText: (file: string) => string;
};

/**
 * The changed files a person sees: those this catalogue can show, with their stories, and those it cannot speak for. A
 * deleted file with no story behind it is left out, as there is nothing left to look at, and so is what every story shows
 * while the catalogue has no story.
 *
 * @param input - the change and the catalogue.
 */
export const changedUiFiles = ({
  files,
  stories,
  everyStoryFiles,
  isOtherCatalogues,
  readText
}: UiFilesInput): { readonly uiFiles: readonly ChangedUiFile[]; readonly outside: readonly string[] } => {
  const uiFiles: ChangedUiFile[] = [];
  const outside: string[] = [];
  for (const { file, path, absolute, isDeleted } of shownFiles(files, stories, everyStoryFiles)) {
    if (!isUiFile(file, isDeleted ? (): string => "" : readText)) continue;
    const forms = isDeleted ? deletedForms(absolute) : [absolute];
    const found = coverageOf(forms, stories, everyStoryFiles.has(absolute));
    if (found.coverage === "none" && isDeleted) continue;
    if (found.coverage === "none" && isOtherCatalogues(absolute)) outside.push(file);
    else uiFiles.push({ file, path, ...found });
  }
  return { uiFiles, outside };
};

/**
 * Whether the nearest catalogue above a file is another one.
 *
 * @param file - the file, absolute, under the catalogue's root as named.
 * @param own - this catalogue's folder.
 * @param root - the repository's folder, in the same form: nothing above it is looked at.
 * @param hasCatalogue - whether a folder holds a catalogue's configuration.
 */
export const belongsToOtherCatalogue = (
  file: string,
  own: string,
  root: string,
  hasCatalogue: (folder: string) => boolean
): boolean => {
  let folder = VITE_PATHS.dirname(file);
  while (folder === root || folder.startsWith(`${root}/`)) {
    if (folder === own) return false;
    if (hasCatalogue(folder)) return true;
    if (folder === root) return false;
    folder = VITE_PATHS.dirname(folder);
  }
  return false;
};
