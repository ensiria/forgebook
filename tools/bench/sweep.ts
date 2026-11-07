/**
 * Every story of a catalogue opened in a browser: which draw, which do not, and why.
 *
 * @remarks
 * A build that exits 0 says nothing about the stories, and neither does the index: on a real library the failures are
 * in what a story needs at run time. So the frame of each story is opened on a dev server and asked for the status it
 * publishes. Forgebook only: the answer is about reading a library's stories, which Storybook defines. The stories
 * listed are what the tool serves, compared with what Storybook's own indexer counts at the pinned commit.
 *
 * @module
 */
import type { Browser } from "@playwright/test";

import { withDeadline } from "./deadline.ts";
import { baseOf, type MeasureContext, startServer, stopServer, waitForServer } from "./measure.ts";

/** How many frames are open at once. */
const JOBS = 4;

/** How long a story may take before it counts as not drawn, in milliseconds. */
const STORY_TIMEOUT = 45_000;

/** The size of an ordinary window. */
const VIEWPORT = { width: 1024, height: 768 };

/** The attribute on a frame's root that says whether its story is shown (`frameStatus.ts`). */
const STATUS = "data-forgebook-status";

/** A cause of failure, with how many stories it took. */
export type SweepFailure = {
  /** What the frame said, the numbers in it removed so one cause groups. */
  readonly reason: string;
  /** How many stories. */
  readonly stories: number;
  /** One of them, to open. */
  readonly example: string;
};

/** What a sweep found. */
export type SweepResult = {
  /** The stories the catalogue listed. */
  readonly listed: number;
  /** The stories it lists in the groups of a component. */
  readonly components: number;
  /** The stories drawn. */
  readonly drawn: number;
  /** The stories not drawn, by cause, the largest first. */
  readonly failures: readonly SweepFailure[];
  /** What the catalogue itself reported as problems. */
  readonly problems: readonly string[];
};

/** How many stories in a row may fail before a sweep stops: every other one would wait out its timeout. */
const GIVE_UP_AFTER = JOBS * 3;

/**
 * Whether a sweep has seen enough: nothing drew at all, so what is broken is the catalogue, not the stories, and going
 * on would take hours of timeouts.
 *
 * @param outcomes - what became of the stories so far.
 */
export const hasGivenUp = (outcomes: readonly { readonly failure: string | undefined }[]): boolean =>
  outcomes.length >= GIVE_UP_AFTER && outcomes.every((outcome) => outcome.failure !== undefined);

/** A story to open. */
export type SweepStory = {
  /** Its id. */
  readonly id: string;
  /** Its frame's address. */
  readonly frame: string;
};

/** What became of a story: nothing when it drew. */
type StoryOutcome = { readonly id: string; readonly failure: string | undefined };

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A field of an object that is a list, or an empty one. */
const listAt = (value: unknown, name: string): readonly unknown[] => {
  const list = isRecord(value) ? value[name] : undefined;
  return Array.isArray(list) ? list : [];
};

/**
 * The stories in the document of `/__forgebook/api/stories`.
 *
 * @param document - the document.
 * @param base - the server's address.
 */
export const storiesOfDocument = (document: unknown, base: string): SweepStory[] =>
  listAt(document, "components").flatMap((component) =>
    listAt(component, "stories").flatMap((story) => {
      const id = isRecord(story) ? story["id"] : undefined;
      if (typeof id !== "string") return [];
      return [{ id, frame: `${base}frame.html?story=${encodeURIComponent(id)}` }];
    })
  );

/**
 * Failures grouped by cause, the largest first.
 *
 * @param outcomes - what became of each story.
 */
export const failuresOf = (outcomes: readonly StoryOutcome[]): SweepFailure[] => {
  const groups = new Map<string, { stories: number; example: string }>();
  for (const { id, failure } of outcomes) {
    if (failure === undefined) continue;
    // the same cause in another file is the same cause: an address or a number would split it into one group a story
    const reason = failure.replace(/https?:\S+/g, "<address>").replace(/\d+/g, "N");
    const group = groups.get(reason);
    if (group === undefined) groups.set(reason, { stories: 1, example: id });
    else group.stories += 1;
  }
  return [...groups]
    .map(([reason, group]) => ({ reason, ...group }))
    .sort((first, second) => second.stories - first.stories);
};

/**
 * The expression a page is polled with until its frame has a status. An expression and not a function's text: Playwright
 * evaluates a string, a function's text is a truthy value, and the wait would return before the story loaded. The root
 * may be missing: a frame that reloads itself on a cold dev server has none between its two documents, and an
 * expression that throws there ends the wait at once, the story counted as failed with that error while it still loads.
 */
export const HAS_STATUS = `["ready", "error"].includes(document.documentElement?.getAttribute(${JSON.stringify(STATUS)}))`;

/** The script that reads the error a frame shows; empty when it shows none. */
const shownError = `document.querySelector(".forgebook-frame-error__message")?.textContent ?? ""`;

/** The first line of a text, cut to a length that groups and prints. */
const firstLine = (text: string): string => (text.split("\n")[0] ?? "").slice(0, 160);

/** Opens one story and reads what became of it. */
const openStory = async (browser: Browser, { id, frame }: SweepStory): Promise<StoryOutcome> => {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const thrown: string[] = [];
  page.on("pageerror", (error) => thrown.push(error.message));
  try {
    await page.goto(frame, { waitUntil: "commit", timeout: STORY_TIMEOUT });
    await page.waitForFunction(HAS_STATUS, null, { timeout: STORY_TIMEOUT });
    const shown = await withDeadline(page.evaluate(shownError), STORY_TIMEOUT, "the frame's error");
    return { id, failure: typeof shown === "string" && shown !== "" ? firstLine(shown) : undefined };
  } catch {
    return { id, failure: firstLine(thrown[0] ?? "no status: the frame never said it was ready") };
  } finally {
    await withDeadline(context.close(), STORY_TIMEOUT, "closing the frame").catch(() => undefined);
  }
};

/**
 * Starts a dev server and opens every story it lists.
 *
 * @param context - the measurement's context, Forgebook's.
 * @param onProgress - told how many stories are done, between stories.
 */
export const sweepStories = async (
  context: MeasureContext,
  onProgress: (done: number, total: number) => void
): Promise<SweepResult> => {
  const server = await startServer(context);
  try {
    const base = baseOf(context);
    await waitForServer(server, base);
    const answer = await fetch(`${base}__forgebook/api/stories`, {
      signal: AbortSignal.timeout(STORY_TIMEOUT)
    });
    // an answer without stories is a catalogue that could not be read, not an empty one
    if (!answer.ok)
      throw new Error(`the catalogue's list failed (${answer.status}): ${firstLine(await answer.text())}`);
    const document: unknown = await answer.json();
    const stories = storiesOfDocument(document, base);
    const outcomes: StoryOutcome[] = [];
    let next = 0;
    const work = async (): Promise<void> => {
      for (let story = stories[next]; story !== undefined; story = stories[next]) {
        next += 1;
        outcomes.push(await openStory(context.browser, story));
        onProgress(outcomes.length, stories.length);
        if (hasGivenUp(outcomes)) {
          next = stories.length;
          throw new Error(`no story of the first ${outcomes.length} drew: ${outcomes[0]?.failure ?? ""}`);
        }
      }
    };
    // every worker ends its story before the server stops: one left in a page would run into the next group
    const settled = await Promise.allSettled(Array.from({ length: JOBS }, work));
    for (const each of settled) if (each.status === "rejected") throw each.reason;
    return {
      listed: stories.length,
      components: listAt(document, "components").length,
      drawn: outcomes.filter((outcome) => outcome.failure === undefined).length,
      failures: failuresOf(outcomes),
      problems: listAt(document, "problems").map(String)
    };
  } finally {
    await stopServer(server);
  }
};
