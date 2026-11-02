/**
 * The pieces of the generated home a written home places among its own text: the pages opened last (`::recent`), the
 * libraries (`::libraries`), their families (`::families`) and their docs pages (`::pages`).
 *
 * @remarks
 * Each piece is drawn by the generated home's own components (`HomePage.tsx`), so a written home that places them
 * looks and behaves as the generated one, and both change together. A piece may show one library (`source="kit"`);
 * a library the catalogue does not have is said in place.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";
import type { ReactNode } from "react";

import type { HomePiece } from "../docPages.ts";
import type { StoryTree, TreeSource } from "../storyTree.ts";
import { DocsCard, FamilyCard, LibrarySection, RecentSection } from "./HomePage.tsx";
import { PAGE_STRINGS } from "./pageStrings.ts";
import type { RecentPage } from "./useRecentPages.ts";

/** What the home's pieces read. */
export type HomePiecesContext = {
  /** The tree. */
  readonly tree: StoryTree;
  /** The sources, for their introductions. */
  readonly sources: readonly StorySource[];
  /** The pages opened last, the newest first. */
  readonly recent: readonly RecentPage[];
  /** A page's address, for its link. */
  readonly hrefOf: (page: RecentPage) => string;
  /** Opens a page. */
  readonly onOpen: (page: RecentPage) => void;
};

/**
 * A piece's heading, when the home gives it one.
 *
 * @param props - the heading.
 */
const PieceHeading = ({ label }: { readonly label: string | undefined }): ReactNode =>
  label === undefined ? null : <h2>{label}</h2>;

/**
 * One piece of the generated home.
 *
 * @param props - the piece, its heading, the library it shows alone, and what the pieces read.
 */
export const HomePieceView = ({
  piece,
  label,
  source,
  context
}: {
  readonly piece: HomePiece;
  readonly label: string | undefined;
  readonly source: string | undefined;
  readonly context: HomePiecesContext;
}): ReactNode => {
  const { tree, sources, recent, hrefOf, onOpen } = context;
  if (piece === "recent")
    return <RecentSection tree={tree} recent={recent} hrefOf={hrefOf} onOpen={onOpen} label={label} />;
  const shown: readonly TreeSource[] =
    source === undefined ? tree.sources : tree.sources.filter((each) => each.id === source);
  if (source !== undefined && shown.length === 0) {
    return (
      <p className="forgebook-problems" role="alert">
        {PAGE_STRINGS.unknownSource(source)}
      </p>
    );
  }
  if (piece === "libraries") {
    return shown.map((each) => (
      <LibrarySection key={each.id} source={each} sources={sources} hrefOf={hrefOf} onOpen={onOpen} />
    ));
  }
  return (
    <section className="forgebook-doc__section">
      <PieceHeading label={label} />
      <div className="forgebook-home__families">
        {piece === "pages"
          ? shown.map((each) =>
              each.pages.length === 0 ? null : (
                <DocsCard key={each.id} source={each} hrefOf={hrefOf} onOpen={onOpen} />
              )
            )
          : shown.flatMap((each) =>
              each.families.map((family) => (
                <FamilyCard
                  key={`${each.id}:${family.name}`}
                  source={each}
                  family={family}
                  hrefOf={hrefOf}
                  onOpen={onOpen}
                />
              ))
            )}
      </div>
    </section>
  );
};
