/**
 * Props another folder declares, which the ordered component takes: they come after its own.
 *
 * @module
 */

/** The shared props. */
export type SharedProps = {
  /** Shared first. */
  readonly shared?: string;
  /** Which way it opens. */
  readonly side?: "top" | "bottom" | "left" | "right";
};
