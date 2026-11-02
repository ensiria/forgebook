/**
 * The catalogue's home as its authors wrote it (`forgebook.home.md`): their text, with the docs pages' blocks, live
 * stories, values (`{{components}}`) and pieces of the generated home (`::families`), in place of the generated home.
 *
 * @remarks
 * Loaded on first use with the docs pages' chunk, and only by a catalogue that has a written home, so the shell's first
 * load pays nothing for it and a catalogue without one keeps its generated home exactly. What the file gets wrong is
 * listed above it, each mistake with its line and column, and the rest still draws. The home has no address of its own
 * for a heading, so a link to one scrolls to it without a new entry in the history.
 *
 * @module
 */
import "./docPage.scss";

import { type ReactNode, useCallback, useMemo, useRef } from "react";

import {
  filledText,
  type HomeDocument,
  headingElementId,
  isHomeDocument,
  OWN_SOURCE_ID
} from "../docPages.ts";
import { anchorOf } from "../pageAddress.ts";
import { findStory } from "../storyTree.ts";
import { CodeText } from "./CodeText.tsx";
import { useCatalogue } from "./catalogueContext.ts";
import {
  blockPlaces,
  catalogueValues,
  DocBlocks,
  type DocBlocksContext,
  queuedBlocks
} from "./DocBlocks.tsx";
import type { DocPageProps } from "./DocPage.tsx";
import type { HomePageProps } from "./HomePage.tsx";
import { PAGE_STRINGS } from "./pageStrings.ts";
import { type Loaded, useLoaded } from "./useLoaded.ts";
import { usePageFrames } from "./usePageFrames.ts";
import { useProseLinks } from "./useProseLinks.ts";
import { useScrollMemory } from "./useScrollMemory.ts";

/** A home that loaded nothing yet. */
const NO_HOME: HomeDocument = { blocks: [], stories: [], notes: [], assets: [] };

/** What the plugin answered, as a state. */
const homeState = (value: unknown): Loaded<HomeDocument> =>
  isHomeDocument(value)
    ? { status: "ready", value }
    : { status: "error", message: "The home has an unexpected shape" };

/** The written home's props: a docs page's, without a page of its own, and the generated home's. */
export type AuthoredHomeProps = Omit<DocPageProps, "location" | "anchor" | "onOpenAnchor" | "onOpenPage"> &
  Pick<HomePageProps, "recent" | "hrefOf" | "onOpen"> & {
    /** Loads the written home, as the plugin compiled it. */
    readonly load: () => Promise<unknown>;
  };

/** The written home's props, as the shell gives them: its loader is the page entry's. */
export type WrittenHomeProps = Omit<AuthoredHomeProps, "load">;

/**
 * What is wrong with the home's file, above it.
 *
 * @param props - the notes.
 */
const HomeNotes = ({ notes }: { readonly notes: readonly string[] }): ReactNode =>
  notes.length === 0 ? null : (
    <div className="forgebook-problems" role="alert">
      <strong>{PAGE_STRINGS.homeProblems}</strong>
      <ul>
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );

/**
 * The written home.
 *
 * @param props - the loader, the generated home's and a docs page's props.
 */
export const AuthoredHome = ({
  load,
  title,
  tree,
  sources,
  recent,
  hrefOf,
  onOpen,
  view,
  touchOverrides,
  onTouchChange,
  frameUrl,
  storyHrefOf,
  onOpenStory,
  pageHrefOf,
  onOpenAddress,
  heightOf,
  backgroundOf,
  header,
  scroll
}: AuthoredHomeProps): ReactNode => {
  const pageRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const loaded = useLoaded(load, homeState);
  const content = loaded.status === "ready" ? loaded.value : NO_HOME;
  const catalogue = useCatalogue();
  const stories = useMemo(
    () => content.stories.flatMap((id) => findStory(tree, id)?.story ?? []),
    [content.stories, tree]
  );
  const queued = useMemo(() => queuedBlocks(content.blocks), [content.blocks]);
  const places = useMemo(() => blockPlaces(content.blocks), [content.blocks]);
  const values = useMemo(() => catalogueValues(title, tree), [title, tree]);
  const frames = usePageFrames({ stories, queued, pageRef, view, touchOverrides });
  useScrollMemory(pageRef, scroll);
  const openLink = useCallback(
    (href: string): boolean => {
      if (href.startsWith("#")) {
        const heading = document.getElementById(headingElementId(anchorOf(href.slice(1)) ?? ""));
        heading?.scrollIntoView({ block: "start" });
        return heading !== null;
      }
      return href.startsWith("?") && onOpenAddress(href);
    },
    [onOpenAddress]
  );
  useProseLinks(bodyRef, openLink);
  const context: DocBlocksContext = {
    tree,
    sources,
    frames,
    view,
    frameUrl,
    switches: catalogue.switches,
    assets: content.assets,
    // a page the home links to by its file is one of the project's own docs pages
    pageHrefOf: (slug: string, anchor: string | undefined): string =>
      pageHrefOf(`${OWN_SOURCE_ID}:${slug}`, anchor),
    stories: { hrefOf: storyHrefOf, onOpen: onOpenStory },
    onTouchChange,
    heightOf,
    backgroundOf,
    values,
    onOpenAddress: openLink,
    home: { tree, sources, recent, hrefOf, onOpen },
    places
  };
  return (
    <div className="forgebook-workspace">
      {header}
      <div ref={pageRef} className="forgebook-scroll">
        <div ref={bodyRef} className="forgebook-home forgebook-home--written">
          {/* the written title only: the catalogue's would show for a moment and be replaced */}
          {loaded.status === "loading" ? null : (
            <header className="forgebook-home__head">
              <h1 className="forgebook-home__title">{filledText(content.title ?? title, values)}</h1>
              {content.description === undefined ? null : (
                <p className="forgebook-doc__lead">
                  <CodeText text={filledText(content.description, values)} />
                </p>
              )}
            </header>
          )}
          {loaded.status === "error" ? (
            <p className="forgebook-problems" role="alert">
              {PAGE_STRINGS.homeError}: {loaded.message}
            </p>
          ) : null}
          <HomeNotes notes={content.notes} />
          <DocBlocks blocks={content.blocks} context={context} />
        </div>
      </div>
    </div>
  );
};

/**
 * The written home as the shell draws it, its loader bound: what the page's entry hands the shell, so the shell's own
 * code holds nothing of the written home.
 *
 * @param load - loads the written home, as the plugin compiled it.
 * @returns the home's component.
 */
export const writtenHome =
  (load: () => Promise<unknown>) =>
  (props: WrittenHomeProps): ReactNode => <AuthoredHome {...props} load={load} />;
