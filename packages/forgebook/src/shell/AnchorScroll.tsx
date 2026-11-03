/**
 * Opens a component's page at the heading or the prop its address names: a piece of its own, so the page pays for it only
 * when an address names one.
 *
 * @module
 */
import type { ReactNode, RefObject } from "react";

import { useAnchorScroll } from "./useAnchorScroll.ts";
import type { PageVisit } from "./useScrollMemory.ts";

/** What it reads. */
export type AnchorScrollProps = {
  /** The page's scrolling element. */
  readonly pageRef: RefObject<HTMLElement | null>;
  /** The heading or the prop the address names. */
  readonly anchor: string;
  /** The visit of the page. */
  readonly visit: PageVisit;
  /** Whether what it names can be there: the page's text and its props arrived. */
  readonly isReady: boolean;
};

/**
 * Keeps what the address names in view; it draws nothing.
 *
 * @param props - the page, the anchor and the visit.
 */
export const AnchorScroll = ({ pageRef, anchor, visit, isReady }: AnchorScrollProps): ReactNode => {
  useAnchorScroll(pageRef, anchor, visit, isReady);
  return null;
};
