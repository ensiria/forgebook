/**
 * The answers about docs pages: the list, and one page to read.
 *
 * @module
 */
import { isDocPage } from "../docPages.ts";
import { findPage, type TreePage } from "../pageTree.ts";
import { sourcePages } from "../sourceFiles.ts";
import type { StoryTree, TreeSource } from "../storyTree.ts";
import { docPageAddressOf } from "../viewState.ts";
import type { AgentPage, PageDocument, PagesDocument } from "./agent.types.ts";
import type { CataloguePages } from "./agentApi.ts";
import { type AgentAnswer, type RouteContext, settled } from "./agentRoutes.ts";

/** A page of the tree as the documents give it. */
const agentPage = (source: TreeSource, page: TreePage, pages: CataloguePages, view: string): AgentPage => ({
  id: page.id,
  title: page.title,
  source: source.id,
  file: page.file,
  description: page.description,
  stories: page.stories,
  components: page.components,
  address: docPageAddressOf(pages.page, page.id, view)
});

/**
 * The docs pages a catalogue has.
 *
 * @param title - the catalogue's name.
 * @param tree - its tree.
 * @param pages - where it is served, for the links.
 * @param view - the view the links open in; empty for the default view.
 */
export const pagesDocument = (
  title: string,
  tree: StoryTree,
  pages: CataloguePages,
  view: string
): PagesDocument => ({
  schema: 1,
  title,
  pages: tree.sources.flatMap((source) => source.pages.map((page) => agentPage(source, page, pages, view))),
  problems: tree.problems
});

/**
 * The docs pages.
 *
 * @param context - what the routes read.
 */
export const pagesAnswer = ({ config, tree, pages, view }: RouteContext): AgentAnswer => ({
  status: 200,
  body: pagesDocument(config.title, tree, pages, view)
});

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
  view
}: Omit<RouteContext, "config">): Promise<AgentAnswer> => {
  const id = params.get("id") ?? "";
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
