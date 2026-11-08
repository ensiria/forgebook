/**
 * The `--json` document of `forgebook-shot`: how a story's frame ended, its size, where its picture went and, when
 * asked, the accessibility rules it breaks.
 *
 * @module
 */
import type { Violation } from "forgebook/a11y";

/** How the frame ended: its story shown, its error shown, given up on what it loads, or no answer in time. */
export type ShotStatus = "ready" | "error" | "pending" | "timeout";

/** What `forgebook-shot` reports. */
export type StoryShot = {
  /** The story's id. */
  readonly story: string;
  /** The frame's address that was opened. */
  readonly address: string;
  /** How the frame ended. */
  readonly status: ShotStatus;
  /** The frame's error, when its story could not be shown. */
  readonly error?: string;
  /** The story's size in CSS px, at the width it was drawn at. */
  readonly size: { readonly width: number; readonly height: number };
  /** The picture's path, when one was written. */
  readonly screenshot?: string;
  /** The errors the page printed or threw. */
  readonly consoleErrors: readonly string[];
  /** The accessibility rules the story breaks, when asked (`--a11y`). */
  readonly violations?: readonly Violation[];
};
