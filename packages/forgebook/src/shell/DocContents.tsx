/**
 * A docs page's contents: its second- and third-level headings, the one being read marked, as a column beside the text
 * where there is room and a list that folds above it where there is not.
 *
 * @module
 */
import { type MouseEvent, type ReactNode, type RefObject, useEffect, useState } from "react";

import { headingElementId } from "../docAnchors.ts";
import { type DocHeading, filledText, type PageValues } from "../docPages.ts";
import { PAGE_STRINGS } from "./pageStrings.ts";

/** How far below the page's top a heading counts as being read, in CSS px. */
const READING_LINE = 96;

/** How far from the page's end the last heading counts as being read: a short last section never reaches the line. */
const END_ROOM = 2;

/**
 * The heading being read: the last one past the reading line, or the last of all at the end of the page.
 *
 * @param scroller - the page's scrolling element.
 * @param headings - the page's headings.
 */
const readHeading = (scroller: HTMLElement, headings: readonly DocHeading[]): string | undefined => {
  if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - END_ROOM)
    return headings.at(-1)?.anchor;
  const line = scroller.getBoundingClientRect().top + READING_LINE;
  let current = headings[0]?.anchor;
  for (const heading of headings) {
    const element = scroller.querySelector(`[id="${CSS.escape(headingElementId(heading.anchor))}"]`);
    if (element === null) continue;
    if (element.getBoundingClientRect().top > line) break;
    current = heading.anchor;
  }
  return current;
};

/**
 * The heading being read, followed as the page scrolls.
 *
 * @param ref - the page's scrolling element.
 * @param headings - the page's headings.
 */
const useReadHeading = (
  ref: RefObject<HTMLElement | null>,
  headings: readonly DocHeading[]
): string | undefined => {
  const [current, setCurrent] = useState<string | undefined>(undefined);
  useEffect(() => {
    const scroller = ref.current;
    if (scroller === null) return;
    let frame: number | undefined;
    const follow = (): void => {
      frame ??= window.requestAnimationFrame((): void => {
        frame = undefined;
        setCurrent(readHeading(scroller, headings));
      });
    };
    follow();
    scroller.addEventListener("scroll", follow, { passive: true });
    return (): void => {
      scroller.removeEventListener("scroll", follow);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [ref, headings]);
  return current;
};

/** The contents' props. */
export type DocContentsProps = {
  /** The page's headings. */
  readonly headings: readonly DocHeading[];
  /** The values a heading's text names (`{{title}}`). */
  readonly values: PageValues;
  /** The page's scrolling element. */
  readonly scrollRef: RefObject<HTMLElement | null>;
  /** Whether there is room for a column beside the text. */
  readonly isColumn: boolean;
  /** A heading's address, for its link. */
  readonly hrefOf: (anchor: string) => string;
  /** Goes to a heading. */
  readonly onOpen: (anchor: string) => void;
};

/**
 * The list of headings.
 *
 * @param props - the headings, the one being read, and how to go to one.
 */
const ContentsList = ({
  headings,
  values,
  current,
  hrefOf,
  onOpen
}: Pick<DocContentsProps, "headings" | "values" | "hrefOf" | "onOpen"> & {
  readonly current: string | undefined;
}): ReactNode => (
  <ul className="forgebook-contents__list">
    {headings.map((heading) => (
      <li key={heading.anchor} data-depth={heading.depth}>
        <a
          className="forgebook-contents__link"
          href={hrefOf(heading.anchor)}
          aria-current={heading.anchor === current ? "location" : undefined}
          onClick={(event: MouseEvent<HTMLAnchorElement>): void => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            onOpen(heading.anchor);
          }}
        >
          {filledText(heading.text, values)}
        </a>
      </li>
    ))}
  </ul>
);

/**
 * A page's contents; nothing for a page with fewer than two headings, which has nothing to find.
 *
 * @param props - the headings, the page's scrolling element, whether there is room for a column, and the links.
 */
export const DocContents = ({
  headings,
  values,
  scrollRef,
  isColumn,
  hrefOf,
  onOpen
}: DocContentsProps): ReactNode => {
  const current = useReadHeading(scrollRef, headings);
  if (headings.length < 2) return null;
  const list = (
    <ContentsList headings={headings} values={values} current={current} hrefOf={hrefOf} onOpen={onOpen} />
  );
  return isColumn ? (
    <nav className="forgebook-contents forgebook-contents--column" aria-label={PAGE_STRINGS.pageContents}>
      <p className="forgebook-contents__title">{PAGE_STRINGS.pageContents}</p>
      {list}
    </nav>
  ) : (
    <details className="forgebook-contents forgebook-contents--fold">
      <summary className="forgebook-contents__title">{PAGE_STRINGS.pageContents}</summary>
      <nav aria-label={PAGE_STRINGS.pageContents}>{list}</nav>
    </details>
  );
};
