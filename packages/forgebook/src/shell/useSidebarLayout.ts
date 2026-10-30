/**
 * The sidebar's width and whether it is shown: this browser's convenience, kept for the next visit, not the address's.
 *
 * @module
 */
import { boundedSidebarWidth, SIDEBAR_WIDTH } from "./SidebarHandle";
import { useStored } from "./useStored";

/** The sidebar's layout and its setters. */
export type SidebarLayout = {
  /** Its width, in CSS px. */
  readonly width: number;
  /** Sets its width. */
  readonly setWidth: (width: number) => void;
  /** Whether it is shown. */
  readonly isOpen: boolean;
  /** Shows or hides it. */
  readonly setIsOpen: (isOpen: boolean) => void;
};

/** The width a stored text holds, or the default. */
const storedWidth = (stored: string | null): number => {
  const width = Number(stored);
  return stored === null || !Number.isFinite(width) ? SIDEBAR_WIDTH.initial : boundedSidebarWidth(width);
};

/** The sidebar's layout. */
export const useSidebarLayout = (): SidebarLayout => {
  const [width, setWidth] = useStored("sidebar-width", storedWidth, String);
  const [isOpen, setIsOpen] = useStored(
    "sidebar",
    (stored: string | null): boolean => stored !== "hidden",
    (shown: boolean): string => (shown ? "shown" : "hidden")
  );
  return { width, setWidth, isOpen, setIsOpen };
};
