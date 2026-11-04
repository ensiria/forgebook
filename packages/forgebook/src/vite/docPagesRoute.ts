/**
 * The answers about docs pages: the list, and one page to read; the catalogue's written home is listed beside them and
 * read as the page `home`.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { relative } from "node:path";

import { isDocPage } from "../docPages.ts";
import { findPage, type TreePage } from "../pageTree.ts";
import { sourcePages } from "../sourceFiles.ts";
import type { StoryTree, TreeSource } from "../storyTree.ts";
import { docPageAddressOf } from "../viewState.ts";
import type { AgentPage, PageDocument, PagesDocument } from "./agent.types.ts";
import type { CataloguePages } from "./agentApi.ts";
import { type AgentAnswer, type RouteContext, settled } from "./agentRoutes.ts";
import type { HomeIndex } from "./docPageMarkdown.ts";
import { pluginFences } from "./pluginConfig.ts";

/** The id `forgebook page` takes for the catalogue's written home. */
export const HOME_PAGE_ID = "home";

/** The written home read: its file from the configuration's folder, its index and its Markdown. */
type ReadHome = { readonly file: string; readonly index: HomeIndex; readonly text: string };

/**
 * The catalogue's written home read from the disk; none without one, or when it cannot be read. The Markdown reader
 * loads with the first question about it: a dev server whose tools never ask starts without it.
 *
 * @param home - its absolute path.
 * @param dir - the configuration's folder.
 * @param fences - the fences the catalogue's plugins draw, which are not code.
 */
const readHome = async (
  home: string | undefined,
  dir: string,
  fences: readonly string[]
): Promise<ReadHome | undefined> => {
  if (home === undefined) return undefined;
  let text: string;
  try {
    text = readFileSync(home, "utf8");
  } catch {
    return undefined;
  }
  const [{ homeIndex }, { frontMatterOf }, { readLinkedFile }] = await Promise.all([
    import("./docPageMarkdown.ts"),
    import("./docMarkdown.ts"),
    import("./docPageLinks.ts")
  ]);
  return {
    file: relative(dir, home),
    index: homeIndex(home, text, readLinkedFile, fences),
    text: frontMatterOf(text).body.trim()
  };
};

/** The written home as the documents give it. */
const agentHome = (title: string, home: ReadHome, pages: CataloguePages, view: string): AgentPage => ({
  id: HOME_PAGE_ID,
  title: home.index.title ?? title,
  source: "",
  file: home.file,
  description: home.index.description,
  stories: home.index.stories,
  components: home.index.components,
  links: { address: view === "" ? pages.page : `${pages.page}?${view}` }
});

/**
 * What is wrong with the written home: its own notes, and the libraries its pieces name that the catalogue lacks.
 *
 * @param home - the home read.
 * @param tree - the catalogue's tree.
 */
const homeProblems = (home: ReadHome, tree: StoryTree): string[] => {
  const known = new Set(tree.sources.map((source) => source.id));
  const missing = [...new Set(home.index.sources)].filter((source) => !known.has(source));
  return [
    ...home.index.notes.map((note) => `Home: ${home.file}: ${note}`),
    ...missing.map(
      (source) => `Home: ${home.file}: it names the library "${source}", which the catalogue does not have`
    )
  ];
};

/** A page of the tree as the documents give it. */
const agentPage = (source: TreeSource, page: TreePage, pages: CataloguePages, view: string): AgentPage => ({
  id: page.id,
  title: page.title,
  source: source.id,
  file: page.file,
  description: page.description,
  stories: page.stories,
  components: page.components,
  links: { address: docPageAddressOf(pages.page, page.id, view) }
});

/**
 * The docs pages a catalogue has.
 *
 * @param title - the catalogue's name.
 * @param tree - its tree.
 * @param pages - where it is served, for the links.
 * @param view - the view the links open in; empty for the default view.
 * @param home - the written home read; none for the generated one.
 */
export const pagesDocument = (
  title: string,
  tree: StoryTree,
  pages: CataloguePages,
  view: string,
  home?: ReadHome
): PagesDocument => ({
  schema: 1,
  title,
  pages: tree.sources.flatMap((source) => source.pages.map((page) => agentPage(source, page, pages, view))),
  ...(home === undefined ? {} : { home: agentHome(title, home, pages, view) }),
  problems: [...tree.problems, ...(home === undefined ? [] : homeProblems(home, tree))]
});

/**
 * The docs pages.
 *
 * @param context - what the routes read.
 */
export const pagesAnswer = async ({ config, tree, pages, view }: RouteContext): Promise<AgentAnswer> => ({
  status: 200,
  body: pagesDocument(
    config.title,
    tree,
    pages,
    view,
    await readHome(config.home, config.dir, pluginFences(config.plugins))
  )
});

/**
 * The written home, read as a page: its Markdown and its problems; a catalogue without one answers it has none.
 *
 * @param config - the configuration's name, home and folder.
 * @param tree - the catalogue's tree.
 * @param pages - where it is served, for the links.
 * @param view - the view the links open in.
 */
const homeAnswer = async (
  config: Pick<RouteContext["config"], "title" | "home" | "dir" | "plugins">,
  tree: StoryTree,
  pages: CataloguePages,
  view: string
): Promise<AgentAnswer> => {
  const home = await readHome(config.home, config.dir, pluginFences(config.plugins));
  if (home === undefined)
    return { status: 404, body: { error: "This catalogue has no written home: its home is generated" } };
  const body: PageDocument = {
    schema: 1,
    page: agentHome(config.title, home, pages, view),
    headings: [],
    text: home.text,
    problems: homeProblems(home, tree)
  };
  return { status: 200, body };
};

/**
 * One docs page: a page that cannot be read gives its problem in the answer, never an error, as a story does.
 *
 * @param context - what the routes read.
 */
export const pageAnswer = async ({
  params,
  tree,
  loaded,
  pages,
  view,
  config
}: Omit<RouteContext, "config"> & {
  readonly config?: Pick<RouteContext["config"], "title" | "home" | "dir" | "plugins">;
}): Promise<AgentAnswer> => {
  const id = params.get("id") ?? "";
  if (id === HOME_PAGE_ID && config !== undefined) return await homeAnswer(config, tree, pages, view);
  const location = findPage(tree, id);
  const source = loaded.sources.find((each) => each.id === location?.source.id);
  if (location === undefined || source === undefined)
    return { status: 404, body: { error: `No page "${id}"` } };
  const files = sourcePages(source);
  const rendered = await settled(files.pages[location.page.file]);
  const text = await settled(files.text[location.page.file]);
  const failures = [rendered, text].flatMap((read) => ("error" in read ? [read.error] : []));
  const page = "value" in rendered && isDocPage(rendered.value) ? rendered.value : undefined;
  const body: PageDocument = {
    schema: 1,
    page: agentPage(location.source, location.page, pages, view),
    headings: page?.headings ?? [],
    text: "value" in text && typeof text.value === "string" ? text.value : "",
    problems: failures.slice(0, 1).map((failure) => `The page failed to load: ${failure}`)
  };
  return { status: 200, body };
};
