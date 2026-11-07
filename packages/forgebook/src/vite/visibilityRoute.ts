/**
 * The answer to `visibility`: the published components of the repository's packages an agent cannot see, every one, or
 * with `since` those a change touches or newly publishes.
 *
 * @remarks
 * The change is held to it, and not the whole repository: a project adopting the gate would otherwise fail on all it has,
 * and turn it off. A name a barrel starts exporting counts as a change of that component, though its own file did not
 * move, since that is the moment it reaches everyone. What cannot be told is said, and never reads as nothing unseen: with
 * no import graph every component would look storyless, so none is judged.
 *
 * @module
 */
import { execFileSync } from "node:child_process";
import { type Dirent, existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { realpath } from "node:fs/promises";

import { offersUsedIn, readsComponentDocs } from "../catalogue.ts";
import { isComponentDocs } from "../componentDocs.ts";
import { printable } from "../printable.ts";
import { sourceFiles } from "../sourceFiles.ts";
import type { StoryTree, TreeComponent } from "../storyTree.ts";
import type { UnseenComponent, VisibilityDocument } from "./agent.types.ts";
import { type AgentAnswer, type RouteContext, settled } from "./agentRoutes.ts";
import { type SeenComponent, unseenComponent } from "./agentVisibility.ts";
import { belongsToOtherCatalogue } from "./changeCoverage.ts";
import { identifiedStories } from "./changedRoute.ts";
import { findConfigFile } from "./configFile.ts";
import { catalogueChangedFiles, changeBase, changedFiles, gitOutput, noBaseReason } from "./gitChange.ts";
import { isPublished, packageEntries } from "./packageEntries.ts";
import { type ExportsDisk, type PublishedFile, publishedComponents } from "./publishedExports.ts";
import type { ReachedStory } from "./storyReach.ts";
import { VITE_PATHS } from "./vitePaths.ts";

/** The extensions an import may leave out, in the order a bundler tries them. */
const RESOLVED_EXTENSIONS = [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".vue", ".svelte"] as const;

/** A package that is a project's sample, published or not: nobody looks for its components. */
const NOT_A_LIBRARY = /(?:^|\/)(?:examples?|fixtures?|__fixtures__|e2e|tests?|__tests__|templates?|docs?)\//;

/** The largest file read: a generated bundle says nothing here, and a hostile one must not hold the server. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** The most files a pattern's folder is walked for. */
const MAX_WALKED = 20_000;

/** A folder's entries; none when it cannot be read. */
const entriesOf = (folder: string): readonly Dirent[] => {
  try {
    return readdirSync(folder, { withFileTypes: true });
  } catch {
    return [];
  }
};

/**
 * Every file under a folder, walked by hand: a recursive listing follows links in circles and goes through `node_modules`.
 *
 * @param folder - the folder.
 */
const filesUnder = (folder: string): readonly string[] => {
  const files: string[] = [];
  const pending = [folder];
  while (pending.length > 0 && files.length < MAX_WALKED) {
    const current = pending.pop() ?? "";
    for (const entry of entriesOf(current)) {
      const path = VITE_PATHS.join(current, entry.name);
      const isWalked = entry.isDirectory() && entry.name !== "node_modules" && !entry.name.startsWith(".");
      if (entry.isFile()) files.push(path);
      else if (isWalked) pending.push(path);
    }
  }
  return files;
};

/**
 * A file's text, and nothing outside the repository: a manifest or an import names what the branch likes, and a link may
 * lead anywhere, so only a regular file under the repository's real folder is read.
 *
 * @param root - the repository's real folder.
 * @param file - the file.
 */
const textIn = (root: string, file: string): string | undefined => {
  try {
    const real = VITE_PATHS.normalize(realpathSync(file));
    if (!real.startsWith(`${root}/`)) return undefined;
    const stats = statSync(real);
    return stats.isFile() && stats.size <= MAX_FILE_BYTES ? readFileSync(real, "utf8") : undefined;
  } catch {
    return undefined;
  }
};

/**
 * What the readers ask of a tree of files: the working tree's, or a commit's.
 *
 * @param exists - whether a file is there.
 * @param readText - its text.
 */
const exportsDisk = (
  exists: (file: string) => boolean,
  readText: (file: string) => string | undefined,
  onAlias: (specifier: string) => void
): ExportsDisk => ({
  readText,
  onAlias,
  resolve: (specifier: string, from: string): string | undefined => {
    const bare = VITE_PATHS.join(VITE_PATHS.dirname(from), specifier);
    const written = bare.replace(/\.[cm]?jsx?$/, "");
    if (/\.(?:[cm]?tsx?|jsx|vue|svelte)$/.test(bare) && exists(bare)) return bare;
    for (const form of [written, `${written}/index`]) {
      for (const extension of RESOLVED_EXTENSIONS) {
        if (exists(`${form}${extension}`)) return `${form}${extension}`;
      }
    }
    return exists(bare) ? bare : undefined;
  }
});

/** What the repository's packages publish, in one tree of files. */
type PublishedTree = {
  /** Their names. */
  readonly packages: readonly string[];
  /** The component files. */
  readonly files: readonly PublishedFile[];
  /** What could not be read, in words, each with the folder of its package. */
  readonly unread: readonly { readonly dir: string; readonly text: string }[];
};

/** A manifest's value, or why it cannot be read. */
const manifestOf = (text: string | undefined): { readonly value: unknown } | { readonly error: string } => {
  try {
    return { value: JSON.parse(text ?? "null") };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * What the packages publish.
 *
 * @param manifests - the packages' manifests, in the catalogue's form of their paths.
 * @param exists - whether a file is there.
 * @param readText - its text.
 * @param listFiles - every file under a folder.
 */
const publishedIn = (
  manifests: readonly string[],
  exists: (file: string) => boolean,
  readText: (file: string) => string | undefined,
  listFiles: (folder: string) => readonly string[]
): PublishedTree => {
  const packages: string[] = [];
  const files: PublishedFile[] = [];
  const seen = new Set<string>();
  const unread: { readonly dir: string; readonly text: string }[] = [];
  for (const file of manifests) {
    const dir = VITE_PATHS.dirname(file);
    const read = manifestOf(readText(file));
    if ("error" in read) {
      unread.push({ dir, text: `a manifest that cannot be read: ${read.error}` });
      continue;
    }
    const manifest = read.value;
    if (!isPublished(manifest)) continue;
    const found = packageEntries(manifest, dir, { exists, filesUnder: listFiles });
    const name =
      typeof manifest === "object" && manifest !== null && "name" in manifest ? String(manifest.name) : dir;
    const aliases = new Set<string>();
    const own = publishedComponents(
      found.entries,
      exportsDisk(exists, readText, (specifier) => aliases.add(specifier))
    );
    if (own.length > 0) packages.push(name);
    files.push(...own.filter((each) => !seen.has(each.file)));
    for (const each of own) seen.add(each.file);
    unread.push(
      ...found.unread.map((path) => ({
        dir,
        text: `a published entry not led back to its source: ${name}: ${path}`
      })),
      ...[...aliases].map((alias) => ({
        dir,
        text: `a published export through an alias not followed: ${name}: ${alias}`
      }))
    );
  }
  return { packages, files, unread };
};

/** The manifests git lists, a new package's among them: the change may be what adds it. */
const manifestsOf = async (dir: string, realDir: string, root: string): Promise<readonly string[]> => {
  const names = (
    await gitOutput(
      root,
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "package.json",
      "*/package.json"
    )
  )
    .split("\0")
    .filter((name) => name !== "" && !NOT_A_LIBRARY.test(name));
  return catalogueChangedFiles(dir, realDir, root, names);
};

/** Each component of a tree. */
const treeComponents = (
  tree: StoryTree
): readonly { readonly source: string; readonly component: TreeComponent }[] =>
  tree.sources.flatMap((source) =>
    source.families.flatMap((family) =>
      family.groups.flatMap((group) =>
        group.components.map((component) => ({ source: source.id, component }))
      )
    )
  );

/** A source's component as the check reads it, with its docs. */
const seenComponent = async (
  { loaded }: RouteContext,
  readStory: (file: string) => string | undefined,
  source: string,
  component: TreeComponent,
  reach: readonly ReachedStory[]
): Promise<SeenComponent> => {
  const own = reach.filter((each) => each.title === component.title);
  const loadedSource = loaded.sources.find((each) => each.id === source);
  const files = loadedSource === undefined ? undefined : sourceFiles(loadedSource);
  const docs = await settled(files?.docs[component.file]);
  const value = "value" in docs && isComponentDocs(docs.value) ? docs.value : undefined;
  return {
    title: component.title,
    storyFile: component.file,
    words: [...component.stories.map((each) => each.name), ...component.keywords],
    listed: component.stories.length,
    unlisted: component.unlisted.length,
    metaFile: own.find((each) => each.metaFile !== undefined)?.metaFile,
    reached: [...new Set(own.flatMap((each) => each.files))],
    storyText: [...new Set(own.map((each) => each.storyFile))]
      .map((file) => readStory(file) ?? "")
      .join("\n"),
    docs:
      value === undefined
        ? undefined
        : {
            props: value.props.length,
            hasText: value.description !== "" || value.summary !== "",
            subcomponents: value.subcomponents.map((each) => each.name)
          },
    description: files?.index[component.file]?.description
  };
};

/** What a commit published, read with git and nothing of the working tree. */
const publishedAt = async (
  dir: string,
  root: string,
  base: string,
  manifests: readonly string[]
): Promise<PublishedTree> => {
  const paths = new Set(
    (await gitOutput(root, "ls-tree", "-r", "-z", "--name-only", base))
      .split("\0")
      .map((name) => VITE_PATHS.join(root, name))
  );
  const inRoot = (file: string): string => VITE_PATHS.join(root, VITE_PATHS.relative(dir, file));
  const fromRoot = (file: string): string => VITE_PATHS.join(dir, VITE_PATHS.relative(root, file));
  const tree = publishedIn(
    manifests.map(inRoot).filter((file) => paths.has(file)),
    (file) => paths.has(file),
    (file) => {
      if (!paths.has(file)) return undefined;
      return execFileSync("git", ["show", `${base}:${VITE_PATHS.relative(root, file)}`], {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024
      });
    },
    (folder) => [...paths].filter((file) => file.startsWith(`${folder}/`))
  );
  return { ...tree, files: tree.files.map((each) => ({ ...each, file: fromRoot(each.file) })) };
};

/** A story file. */
const STORY_FILE = /\.stories\.[^/]+$/;

/** A name with what does not change its reading taken off. */
const plainWord = (name: string): string => name.replace(/[^A-Za-z0-9]/g, "").toLowerCase();

/** What a file is named after: itself, or its folder for an index. */
const namedAfter = (file: string): string => {
  const parts = file.split("/");
  const name = (parts.at(-1) ?? "").replace(/\.[^.]+$/, "");
  return name === "index" ? (parts.at(-2) ?? name) : name;
};

/**
 * What a story file may be about, in plain words: its own name, and its folder's, past a folder only for stories
 * (`Box/stories/Simple.stories.js` is about `Box`).
 */
const storyFileNames = (file: string): readonly string[] => {
  const parts = file.split("/").slice(0, -1);
  const folders = parts.filter((part) => !/^_*stories_*$/.test(part)).slice(-1);
  const name = (file.split("/").at(-1) ?? "").replace(/\.stories\.[^/]+$/, "");
  return [name, ...folders].map(plainWord);
};

/**
 * The published files a change holds to the check: those it edits, and those it starts publishing or names anew.
 *
 * @param now - what is published now.
 * @param changed - the files it changes, in the catalogue's form.
 * @param readBefore - what the change's start published; read only when an entry or a barrel changed.
 */
export const filesOfChange = async (
  now: readonly PublishedFile[],
  changed: readonly string[],
  readBefore: () => Promise<readonly PublishedFile[]>
): Promise<readonly PublishedFile[]> => {
  const moved = new Set(changed);
  // losing a story, its listing or its meta's component hides a component whose own file did not move
  const stories = changed.filter((file) => STORY_FILE.test(file)).flatMap(storyFileNames);
  const edited = now.filter(
    ({ file, names }) =>
      moved.has(file) || [...names, namedAfter(file)].some((name) => stories.includes(plainWord(name)))
  );
  // a change touching only components cannot have published anything new, and a commit's tree costs a git call per file
  if (changed.every((file) => STORY_FILE.test(file) || now.some((each) => each.file === file))) return edited;
  const before = new Map((await readBefore()).map((each) => [each.file, new Set(each.names)]));
  const named = now.filter((each) => {
    const known = before.get(each.file);
    return !edited.includes(each) && each.names.some((name) => known?.has(name) !== true);
  });
  return [...edited, ...named];
};

/**
 * What agents cannot see.
 *
 * @param context - what the routes read.
 */
export const visibilityAnswer = async (context: RouteContext): Promise<AgentAnswer> => {
  const { config, loaded, tree, params } = context;
  const since = params.get("since") || undefined;
  const base = since === undefined ? undefined : await changeBase(config.dir, since);
  if (since !== undefined && base === undefined)
    return { status: 400, body: { error: await noBaseReason(config.dir, since) } };
  const answerOf = (
    packages: readonly string[],
    unseen: readonly UnseenComponent[],
    checked: number,
    skipped: readonly string[]
  ): AgentAnswer => {
    const body: VisibilityDocument = {
      schema: 1,
      ...(since === undefined ? {} : { since }),
      packages,
      checked,
      unseen,
      // a branch writes these: what reaches an agent or a terminal holds no control character
      skipped: skipped.map(printable)
    };
    return { status: 200, body };
  };
  const realDir = await realpath(config.dir);
  const root = await gitOutput(config.dir, "rev-parse", "--show-toplevel").then(
    (text) => text.trim(),
    () => undefined
  );
  if (root === undefined)
    return answerOf([], [], 0, ["what agents see not checked: this is not a git repository"]);
  const rootInDir = VITE_PATHS.join(config.dir, VITE_PATHS.relative(realDir, root));
  const manifests = await manifestsOf(config.dir, realDir, root);
  const own = VITE_PATHS.normalize(config.dir);
  const realRoot = VITE_PATHS.normalize(realpathSync(root));
  const published = publishedIn(
    manifests.filter(
      (file) =>
        !belongsToOtherCatalogue(file, own, rootInDir, (folder) => findConfigFile(folder) !== undefined)
    ),
    (file) => existsSync(file),
    (file) => textIn(realRoot, file),
    filesUnder
  );
  const change = base === undefined ? undefined : await changedFiles(config.dir, base);
  const changed = change === undefined ? [] : catalogueChangedFiles(config.dir, realDir, root, change.files);
  // a package the change does not touch is no reason to call the change only partly verified
  const unread = published.unread
    .filter(({ dir }) => change === undefined || changed.some((file) => file.startsWith(`${dir}/`)))
    .map(({ text }) => text);
  if (!offersUsedIn(config.lists) || !readsComponentDocs(config.lists))
    return answerOf(published.packages, [], 0, [
      ...unread,
      "what agents see not checked: the catalogue turns off the component docs or Used in, which it reads"
    ]);
  const relevant =
    change === undefined || base === undefined
      ? published.files
      : await filesOfChange(
          published.files,
          changed,
          async () => (await publishedAt(rootInDir, root, base, manifests)).files
        );
  if (relevant.length === 0) return answerOf(published.packages, [], 0, unread);
  const { groups, identified } = await identifiedStories(loaded, tree);
  // with no graph every component would look storyless
  if (groups.some(({ reach }) => typeof reach === "string"))
    return answerOf(published.packages, [], 0, [
      ...unread,
      "what agents see not checked: the stories' imports could not be read"
    ]);
  const reach = identified.map((each) => each.reach);
  const components = await Promise.all(
    treeComponents(tree).map(({ source, component }) =>
      seenComponent(context, (file) => textIn(realRoot, file), source, component, reach)
    )
  );
  const unseen = relevant.flatMap((file) => {
    const path = VITE_PATHS.relative(config.dir, file.file);
    const found = unseenComponent(file, path, VITE_PATHS.relative(rootInDir, file.file), components);
    return found === undefined ? [] : [found];
  });
  return answerOf(published.packages, unseen, relevant.length, unread);
};
