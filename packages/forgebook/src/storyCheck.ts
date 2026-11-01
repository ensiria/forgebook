/**
 * The shapes of a story check and of a story's pictures, shared by `forgebook check` and `forgebook shot` (which ask)
 * and `@forgebook/testing/check` and `/shot` (which run them in a browser): the stories and views, and the problems
 * found in each or the pictures taken.
 *
 * @remarks
 * The command builds the request from the catalogue it runs against, loads the testing package from the project only
 * when it runs (the core has no browser), and reads the report back through `isStoryCheckReport`, since it crossed a
 * dynamic import. The problems are those the catalogue's browser tests fail on, with the same messages: a frame that
 * could not show its story, axe's rules, spills, overlays past the frame, and the page's errors (a failed play among
 * them: its rejection reaches the page). Pure.
 *
 * @module
 */
import type { CatalogueLists } from "./catalogue.ts";
import type { ViewSwitch } from "./switches.ts";

/** What kind of check found a problem. */
export type StoryProblemKind = "frame" | "axe" | "spill" | "overlay" | "error";

/** One problem a check found. */
export type StoryProblem = {
  /** The check that found it. */
  readonly kind: StoryProblemKind;
  /** The rule broken, for axe (`color-contrast`). */
  readonly rule?: string;
  /** The element at fault, as a selector, when the check names one. */
  readonly element?: string;
  /** What is wrong, as the catalogue's tests say it. */
  readonly message: string;
};

/** A story to check: its id, and the height its scene declares. */
export type StoryCheckStory = {
  /** The story's id. */
  readonly id: string;
  /** Its `parameters.height`, in CSS px, when it declares one: an overlay inside it is not a problem. */
  readonly height?: number;
  /** Whether it is about logic, not looks (`parameters.logic`): every variant then means its default view only. */
  readonly isLogic?: boolean;
};

/** What a check is asked to do. */
export type StoryCheckRequest = {
  /** The frame page's absolute address (`http://localhost:5173/frame.html`). */
  readonly frameUrl: string;
  /** The stories. */
  readonly stories: readonly StoryCheckStory[];
  /** The catalogue's switches, as its configuration gives them. */
  readonly switches: readonly ViewSwitch[];
  /** The catalogue's lists: its accessibility rules, backgrounds, text sizes. */
  readonly lists: CatalogueLists;
  /** The views, each in the address's form (`theme=dark&lang=it`); none for the default view alone. */
  readonly views: readonly string[];
  /** Check every variant the catalogue's browser tests check instead of the views given. */
  readonly isAllVariants: boolean;
};

/** One story in one view, and its problems. */
export type StoryCheckResult = {
  /** The story's id. */
  readonly storyId: string;
  /** The view, as asked (`theme=dark`), or the variant's name; empty for the default view. */
  readonly view: string;
  /** Where it was opened: its frame in that view. */
  readonly frame: string;
  /** The problems; none when it passes. */
  readonly problems: readonly StoryProblem[];
};

/** What a check found. */
export type StoryCheckReport = {
  /** The shape's version. */
  readonly schema: 1;
  /** One result per story and view. */
  readonly results: readonly StoryCheckResult[];
};

/** Every kind, for reading a report back. */
const KINDS: readonly StoryProblemKind[] = ["frame", "axe", "spill", "overlay", "error"];

/**
 * Whether a value is a problem.
 *
 * @param value - the value.
 */
const isProblem = (value: unknown): value is StoryProblem =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  KINDS.some((kind) => kind === value.kind) &&
  "message" in value &&
  typeof value.message === "string";

/**
 * Whether a value is a result.
 *
 * @param value - the value.
 */
const isResult = (value: unknown): value is StoryCheckResult =>
  typeof value === "object" &&
  value !== null &&
  "storyId" in value &&
  typeof value.storyId === "string" &&
  "view" in value &&
  typeof value.view === "string" &&
  "frame" in value &&
  typeof value.frame === "string" &&
  "problems" in value &&
  Array.isArray(value.problems) &&
  value.problems.every(isProblem);

/**
 * Whether what the testing package answered is a check's report.
 *
 * @param value - the answer.
 */
export const isStoryCheckReport = (value: unknown): value is StoryCheckReport =>
  typeof value === "object" &&
  value !== null &&
  "schema" in value &&
  value.schema === 1 &&
  "results" in value &&
  Array.isArray(value.results) &&
  value.results.every(isResult);

/** What a picture run is asked to do: a check's stories and views, and where the pictures go. */
export type StoryShotRequest = StoryCheckRequest & {
  /** The folder the pictures are written in, absolute; made when missing. */
  readonly outDir: string;
};

/** One story's picture in one view. */
export type StoryShot = {
  /** The story's id. */
  readonly storyId: string;
  /** The view, as asked, or the variant's name; empty for the default view. */
  readonly view: string;
  /** Where it was opened. */
  readonly frame: string;
  /** The picture, a PNG file's absolute path. */
  readonly file: string;
};

/** The pictures taken. */
export type StoryShotReport = {
  /** The shape's version. */
  readonly schema: 1;
  /** One picture per story and view. */
  readonly shots: readonly StoryShot[];
};

/**
 * Whether what the testing package answered is a picture run's report.
 *
 * @param value - the answer.
 */
export const isStoryShotReport = (value: unknown): value is StoryShotReport =>
  typeof value === "object" &&
  value !== null &&
  "schema" in value &&
  value.schema === 1 &&
  "shots" in value &&
  Array.isArray(value.shots) &&
  value.shots.every(
    (shot: unknown) =>
      typeof shot === "object" &&
      shot !== null &&
      "storyId" in shot &&
      typeof shot.storyId === "string" &&
      "view" in shot &&
      typeof shot.view === "string" &&
      "frame" in shot &&
      typeof shot.frame === "string" &&
      "file" in shot &&
      typeof shot.file === "string"
  );
