/**
 * The answer to a search across the catalogue: the same search the shell runs, from the same index, each result and
 * hit with the address that opens it where it matched.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";

import {
  type SearchHit,
  type SearchResult,
  type SearchTarget,
  searchables,
  searchCatalogue
} from "../search.ts";
import { isSearchIndex, mergedSearchIndex, type SearchIndex } from "../searchIndex.ts";
import type { MarkedText } from "../searchMarks.ts";
import { sourceSearchLoaders } from "../sourceFiles.ts";
import { componentAddressOf, docPageAddressOf, storyAddressOf } from "../viewState.ts";
import type { AgentSearchHit, AgentSearchResult, SearchDocument } from "./agent.types.ts";
import type { CataloguePages } from "./agentApi.ts";
import { type AgentAnswer, type RouteContext, settled } from "./agentRoutes.ts";

/** How many results an answer gives unless asked: agents degrade with long context. */
const DEFAULT_LIMIT = 8;

/** How many results an answer can give. */
const MAX_LIMIT = 50;

/** How many hits each result lists. */
const HITS = 3;

/** A marked text as plain text. */
const plain = (text: readonly MarkedText[]): string => text.map((piece) => piece.text).join("");

/** The address a search's target opens. */
const addressOf = (target: SearchTarget, pages: CataloguePages, view: string): string => {
  if (target.kind === "story") return storyAddressOf(pages.page, target.id, view);
  const address =
    target.kind === "page"
      ? docPageAddressOf(pages.page, target.id, view)
      : componentAddressOf(pages.page, target.id, view);
  return target.anchor === undefined ? address : `${address}#${encodeURIComponent(target.anchor)}`;
};

/** A hit as the document gives it. */
const agentHit = (hit: SearchHit, pages: CataloguePages, view: string): AgentSearchHit => ({
  kind: hit.kind,
  ...(hit.label === undefined ? {} : { name: plain(hit.label) }),
  text: plain(hit.snippet),
  address: addressOf(hit.target, pages, view)
});

/** A result as the document gives it. */
const agentResult = (result: SearchResult, pages: CataloguePages, view: string): AgentSearchResult => ({
  kind: result.kind,
  id: result.target.id,
  name: plain(result.name),
  place: result.place,
  score: result.score,
  matched: result.matched,
  missed: result.missed,
  reasons: result.reasons,
  hits: result.hits.map((hit) => agentHit(hit, pages, view)),
  hitCount: result.hitCount,
  address: addressOf(result.target, pages, view)
});

/** A source's index, every group's read, with why one could not be. */
const indexOf = async (
  source: StorySource
): Promise<{ readonly index: SearchIndex; readonly problems: readonly string[] }> => {
  const read = await Promise.all(sourceSearchLoaders(source).map((load) => settled(load)));
  const problems = read.flatMap((each) => ("error" in each ? [`${source.name}: ${each.error}`] : []));
  const indexes = read.flatMap((each) => ("value" in each && isSearchIndex(each.value) ? [each.value] : []));
  return { index: mergedSearchIndex(indexes), problems };
};

/** The limit asked for, within what an answer can give. */
const limitOf = (text: string | null): number => {
  const limit = Number(text ?? DEFAULT_LIMIT);
  return Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT;
};

/**
 * What a query finds across the catalogue.
 *
 * @param context - what the routes read.
 */
export const searchAnswer = async ({
  tree,
  params,
  pages,
  view,
  loaded
}: RouteContext): Promise<AgentAnswer> => {
  const query = params.get("query") ?? "";
  if (query.trim() === "") return { status: 400, body: { error: "No words to look for" } };
  const read = await Promise.all(
    loaded.sources.map(async (source) => ({ id: source.id, ...(await indexOf(source)) }))
  );
  const indexes = new Map(read.map(({ id, index }) => [id, index]));
  const answer = searchCatalogue(searchables(tree, indexes), query, {
    results: limitOf(params.get("limit")),
    hits: HITS
  });
  const body: SearchDocument = {
    schema: 1,
    query,
    total: answer.total,
    results: answer.results.map((result) => agentResult(result, pages, view)),
    corrections: answer.corrections,
    problems: read.flatMap(({ index, problems }) => [...problems, ...(index.problems ?? [])])
  };
  return { status: 200, body };
};
