/**
 * Which sections a component's page drawn for one audience shows, and where around its frames. Each audience is one row
 * of a table, the same page reordered and filtered.
 *
 * @remarks
 * The sections sit in three places around the frames, because the frames must never move: an `iframe` moved in the
 * document loads again, losing its story's state and costing a load per story for a change of reading. So the demo
 * and the examples stay where they are, and only what goes around them changes. `everyone` is not here: its page is
 * `ComponentPage.tsx`'s own. The table is apart from the sections' texts and code (`audiencePage.ts`), which load with
 * the first page drawn for someone else: the page reads it before that chunk comes, to start loading what the
 * audience's sections read alongside it rather than after it.
 *
 * @module
 */
import type { AudienceId } from "../audiences.ts";

/** A part of the page around its frames. */
export type PageSection =
  | "lead"
  | "guidance"
  | "prose"
  | "api"
  | "parts"
  | "pages"
  | "tokens"
  | "coverage"
  | "usedIn";

/** What of the documentation file an audience sees: all of it, without what is about code, or what testing reads. */
export type ProseReading = "whole" | "design" | "testing";

/** An audience's page. */
export type AudiencePage = {
  /** The sections above the demo, in their order. */
  readonly beforeDemo: readonly PageSection[];
  /** The sections between the demo and the examples. */
  readonly afterDemo: readonly PageSection[];
  /** The sections after the examples. */
  readonly afterExamples: readonly PageSection[];
  /** What of the documentation file it sees. */
  readonly prose: ProseReading;
};

/** Each audience's page. */
export const AUDIENCE_PAGES: Readonly<Record<Exclude<AudienceId, "everyone">, AudiencePage>> = {
  designer: {
    beforeDemo: ["lead", "guidance"],
    afterDemo: ["prose", "pages", "tokens"],
    afterExamples: ["usedIn"],
    prose: "design"
  },
  coder: {
    beforeDemo: ["lead", "api", "parts"],
    afterDemo: ["prose"],
    afterExamples: ["usedIn"],
    prose: "whole"
  },
  tester: {
    beforeDemo: ["lead", "coverage"],
    afterDemo: ["prose", "parts"],
    afterExamples: [],
    prose: "testing"
  }
};

/**
 * Whether a page drawn for an audience shows a section, in any of its places.
 *
 * @param audience - who the page is drawn for; `everyone`'s page shows none of the table's sections.
 * @param section - the section.
 */
export const showsSection = (audience: AudienceId, section: PageSection): boolean => {
  if (audience === "everyone") return false;
  const { beforeDemo, afterDemo, afterExamples } = AUDIENCE_PAGES[audience];
  return [...beforeDemo, ...afterDemo, ...afterExamples].includes(section);
};
