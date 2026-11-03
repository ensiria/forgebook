/**
 * The types of the wind's badge, which is written in JavaScript: what the TypeScript files that draw it read.
 *
 * @module
 */
import type { ReactNode } from "react";

/** The badge's props. */
export type WindBadgeProps = {
  /** The wind's speed, in knots. */
  readonly knots: number;
  /** The unit it is written in; knots by default. */
  readonly unit?: "kn" | "km/h";
};

/** The wind's badge. */
export declare const WindBadge: (props: WindBadgeProps) => ReactNode;
