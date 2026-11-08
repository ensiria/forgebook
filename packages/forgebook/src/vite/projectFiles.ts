/**
 * The files of a project a static reading takes: its styles and components, what git knows of them, inside the repository.
 *
 * @remarks
 * Shared by what reads a whole project without a catalogue (`forgebook audit`) and by `check-code`; the audit also reads
 * the scripts, which import components and hold stories. A tracked link may lead
 * anywhere, and a repository may hold more than memory, so both are bounded here and said in `notes`.
 *
 * @module
 */
import { join } from "node:path";

import { listedFiles, repositoryOf, smallFileText } from "./appTokenFiles.ts";
import { isInside } from "./sourceTokens.ts";

/** A file of a project. */
export type ProjectFile = {
  /** Its path, relative to the folder asked about. */
  readonly file: string;
  /** Its text. */
  readonly text: string;
};

/** A package of a repository. */
export type WorkspacePackage = {
  /** Its name; empty for none. */
  readonly name: string;
  /** Its folder, from the repository; empty for its root. */
  readonly dir: string;
  /** The packages it depends on, by name. */
  readonly dependsOn: readonly string[];
};

/** What git is asked for. */
export const UI_PATTERNS: readonly string[] = [
  "*.css",
  "*.scss",
  "*.sass",
  "*.less",
  "*.tsx",
  "*.jsx",
  "*.vue",
  "*.svelte",
  "*.astro"
];

/** The same, for a file's name. */
const UI_FILE = /\.(?:css|scss|sass|less|tsx|jsx|vue|svelte|astro)$/;

/** What is not the project's own code: copies, generated output and what a package brought. */
const NOT_ITS_CODE =
  /(?:^|\/)(?:node_modules|dist|build|out|coverage|vendor|vendors|public|static|\.next|\.nuxt|\.svelte-kit|\.astro|\.turbo|storybook-static)\//;

/** Past this a project's files are not all read, and the report says so. */
const MOST_FILES = 5000;

/** Past this much text a report stops reading, rather than run out of memory on what no one wrote by hand. */
export const MOST_BYTES = 200_000_000;

/**
 * The project's files inside its repository, relative to its folder, without reading them.
 *
 * @param dir - its folder.
 * @param notes - told of what is left out.
 */
export const listedProjectFiles = (dir: string, notes: string[]): string[] => {
  const root = repositoryOf(dir);
  const listed = listedFiles(dir, UI_PATTERNS, UI_FILE, NOT_ITS_CODE).filter(
    (file) => !NOT_ITS_CODE.test(file)
  );
  if (listed.length > MOST_FILES)
    notes.push(`${listed.length - MOST_FILES} files past the first ${MOST_FILES} not read`);
  // a tracked link may lead anywhere
  return listed.slice(0, MOST_FILES).filter((file) => isInside(root, join(dir, file)));
};

/** Reads listed files, up to the bytes a report reads, and says when it stops. */
const readFiles = (dir: string, listed: readonly string[], notes: string[]): ProjectFile[] => {
  let bytes = 0;
  const read = listed.flatMap((file) => {
    const text = bytes > MOST_BYTES ? undefined : smallFileText(join(dir, file));
    bytes += text?.length ?? 0;
    return text === undefined ? [] : [{ file, text }];
  });
  if (bytes > MOST_BYTES) notes.push(`files past the first ${MOST_BYTES} bytes not read`);
  return read;
};

/**
 * Reads a project's files.
 *
 * @param dir - its folder.
 * @param notes - told of what is left out.
 */
export const projectFiles = (dir: string, notes: string[]): ProjectFile[] =>
  readFiles(dir, listedProjectFiles(dir, notes), notes);

/** The scripts git is asked for: what may import a component or hold a story, with no markup of its own. */
const SCRIPT_PATTERNS: readonly string[] = ["*.ts", "*.mts", "*.cts", "*.js", "*.mjs", "*.cjs"];

/** The same, for a file's name; a type declaration imports nothing that runs. */
const SCRIPT_FILE = /(?<!\.d)\.[cm]?[jt]s$/;

/** A project's files and its scripts, read under one bound of files and bytes. */
export type FilesAndScripts = {
  /** Its styles and components, as {@link projectFiles} reads them. */
  readonly files: readonly ProjectFile[];
  /** Its scripts, read with what room the files left. */
  readonly scripts: readonly ProjectFile[];
};

/**
 * Reads a project's files and then its scripts, the two together held to the bounds {@link projectFiles} keeps alone.
 *
 * @param dir - its folder.
 * @param notes - told of what is left out.
 */
export const projectFilesAndScripts = (dir: string, notes: string[]): FilesAndScripts => {
  const root = repositoryOf(dir);
  const ui = listedProjectFiles(dir, notes);
  const listed = listedFiles(dir, SCRIPT_PATTERNS, SCRIPT_FILE, NOT_ITS_CODE).filter(
    (file) => SCRIPT_FILE.test(file) && !NOT_ITS_CODE.test(file)
  );
  const room = Math.max(0, MOST_FILES - ui.length);
  if (listed.length > room)
    notes.push(`${listed.length - room} scripts past the first ${MOST_FILES} files not read`);
  const scripts = new Set(listed.slice(0, room).filter((file) => isInside(root, join(dir, file))));
  const read = readFiles(dir, [...ui, ...scripts], notes);
  return {
    files: read.filter(({ file }) => !scripts.has(file)),
    scripts: read.filter(({ file }) => scripts.has(file))
  };
};

/**
 * The packages of a repository, from their manifests, read and not run.
 *
 * @param root - the repository.
 */
export const workspacePackages = (root: string): WorkspacePackage[] =>
  listedFiles(root, ["package.json", "*/package.json"], /^package\.json$/, NOT_ITS_CODE)
    .filter((file) => !NOT_ITS_CODE.test(file))
    .slice(0, MOST_FILES)
    .flatMap((file): WorkspacePackage[] => {
      try {
        const parsed: unknown = JSON.parse(smallFileText(join(root, file)) ?? "");
        if (typeof parsed !== "object" || parsed === null) return [];
        const fields = new Map(Object.entries(parsed));
        const name = fields.get("name");
        const dependsOn = ["dependencies", "devDependencies", "peerDependencies"].flatMap((key) => {
          const list: unknown = fields.get(key);
          return typeof list === "object" && list !== null ? Object.keys(list) : [];
        });
        const dir = file === "package.json" ? "" : file.slice(0, -"/package.json".length);
        return [{ name: typeof name === "string" ? name : "", dir, dependsOn }];
      } catch {
        return [];
      }
    });
