/**
 * What a component's stories cover, for whoever tests it: each story in the page's order, what it shows, its group, its
 * play function, whether the generated tests run it, and its accessibility check once asked for.
 *
 * @remarks
 * Part of the audiences' chunk. The table reads the index only, so it costs no frame. The check is asked for by a
 * person, never by itself: axe downloads with the first one, and the page's far frames load for it through the queue. A
 * frame already there is asked at once, and answers with its check or its error; one still loading gets asked by its
 * ready message, since a message sent to a document still loading is lost. The details of a broken rule stay on the story's page, in its Accessibility tab.
 *
 * @module
 */
import { type ReactNode, type RefObject, useRef, useState } from "react";

import { groupLabel, type StoryGroupSetting } from "../catalogue.ts";
import type { ShellMessage } from "../messages.ts";
import { groupedStories, type TreeStory } from "../storyTree.ts";
import type { CheckState } from "./A11yTab.tsx";
import { AUDIENCE_TEXTS } from "./audiencePage.ts";
import { CodeText } from "./CodeText.tsx";
import { a11yHint } from "./dockHints.ts";
import { type ExampleContext, StoryLink } from "./Example.tsx";
import { framesOrigin } from "./framesOrigin.ts";
import { type CheckResult, type ReadyMessage, useFrameMessages } from "./useFrameMessages.ts";
import type { FrameQueue } from "./useFrameQueue.ts";

/** Each story's check, by its id: a story that was not asked for yet has none. */
type PageChecks = ReadonlyMap<string, CheckState>;

/** What the page's checks give. */
type PageChecksState = {
  /** Each story's check. */
  readonly checks: PageChecks;
  /** Asks for every story's check. */
  readonly checkAll: () => void;
};

/**
 * The checks of a page's stories.
 *
 * @param pageRef - the element that holds the page's frames.
 * @param queue - the page's frames' queue.
 */
const usePageChecks = (
  pageRef: RefObject<HTMLElement | null>,
  queue: Pick<FrameQueue, "loadAll">
): PageChecksState => {
  const [checks, setChecks] = useState<PageChecks>(new Map());
  const isAsked = useRef(false);
  // the checks under way: a frame is asked once, since a second run of axe in a document refuses to start; its ready
  // message, once per document, asks again a frame whose first ask arrived while it loaded
  const running = useRef(new Set<string>());

  const setCheck = (storyId: string, check: CheckState): void =>
    setChecks((current) => new Map(current).set(storyId, check));

  const ask = (frame: Window, storyId: string): void => {
    if (running.current.has(storyId)) return;
    running.current.add(storyId);
    setCheck(storyId, { status: "running" });
    const message: ShellMessage = { type: "forgebook:check" };
    frame.postMessage(message, framesOrigin());
  };

  useFrameMessages({
    // a frame asked while it still loaded lost the message: its ready message asks it again
    onReady: (frame: Window, { storyId }: ReadyMessage): void => {
      if (!isAsked.current) return;
      running.current.delete(storyId);
      ask(frame, storyId);
    },
    onCall: (): void => undefined,
    onFailed: (storyId: string): void => {
      running.current.delete(storyId);
      if (isAsked.current) setCheck(storyId, { status: "error", message: AUDIENCE_TEXTS.coverageFailed });
    },
    onChecked: (result: CheckResult): void => {
      // a check asked for before the view changed answers for a view no longer shown
      if (!running.current.delete(result.storyId)) return;
      setCheck(
        result.storyId,
        "error" in result
          ? { status: "error", message: result.error }
          : { status: "done", violations: result.violations }
      );
    }
  });

  const checkAll = (): void => {
    isAsked.current = true;
    queue.loadAll();
    // every frame is asked: one whose story is drawn answers its check, one that failed its error; one still loading
    // loses the message and is asked by its ready message
    for (const frame of pageRef.current?.querySelectorAll("iframe") ?? []) {
      const storyId = new URL(frame.src, window.location.href).searchParams.get("story");
      if (storyId === null || frame.contentWindow === null) continue;
      ask(frame.contentWindow, storyId);
    }
  };

  return { checks, checkAll };
};

/** The section's props. */
export type StoryCoverageProps = Pick<ExampleContext, "hrefOf" | "onOpen"> & {
  /** The component's stories, as the page lists them. */
  readonly stories: readonly TreeStory[];
  /** The groups the catalogue names, in their order. */
  readonly storyGroups: readonly StoryGroupSetting[];
  /** The page's frames' queue, which loads them for a check. */
  readonly queue: Pick<FrameQueue, "loadAll">;
  /** The element that holds the page's frames. */
  readonly pageRef: RefObject<HTMLElement | null>;
};

/** Whether the generated tests leave a story out. */
const isUntested = (story: TreeStory): boolean => story.tags.includes("!test");

/**
 * A check as a table's cell says it.
 *
 * @param check - the story's check; none before it is asked for.
 */
const checkText = (check: CheckState | undefined): string => {
  if (check === undefined || check.status === "idle") return AUDIENCE_TEXTS.coverageNotChecked;
  if (check.status === "running") return AUDIENCE_TEXTS.coverageChecking;
  if (check.status === "error") return check.message;
  return a11yHint(check) ?? AUDIENCE_TEXTS.coverageNotChecked;
};

/**
 * What the stories cover.
 *
 * @param props - the stories, how they group and open, and the page's frames.
 */
export const StoryCoverage = ({
  stories,
  storyGroups,
  queue,
  pageRef,
  hrefOf,
  onOpen
}: StoryCoverageProps): ReactNode => {
  const { checks, checkAll } = usePageChecks(pageRef, queue);
  const ordered = groupedStories(
    stories,
    storyGroups.map((group) => group.id)
  ).flatMap((section) => section.stories);
  const played = stories.filter((story) => story.hasPlay).length;
  const untested = stories.filter(isUntested).length;
  const finished = [...checks.values()].filter((check) => check.status !== "running").length;
  return (
    <section className="forgebook-doc__section" aria-labelledby="forgebook-coverage">
      <h2 id="forgebook-coverage">{AUDIENCE_TEXTS.coverage}</h2>
      <div className="forgebook-coverage__head">
        <p className="forgebook-coverage__summary">
          {AUDIENCE_TEXTS.coverageSummary(stories.length, played, untested)}
        </p>
        <button type="button" className="forgebook-button" onClick={checkAll}>
          {AUDIENCE_TEXTS.coverageCheckAll}
        </button>
      </div>
      <p className="forgebook-coverage__progress" role="status">
        {checks.size === 0 ? "" : AUDIENCE_TEXTS.coverageChecked(finished, stories.length)}
      </p>
      <div className="forgebook-api">
        <table className="forgebook-api__table">
          <thead>
            <tr>
              <th scope="col">{AUDIENCE_TEXTS.coverageStory}</th>
              <th scope="col">{AUDIENCE_TEXTS.coverageGroup}</th>
              <th scope="col">{AUDIENCE_TEXTS.coveragePlay}</th>
              <th scope="col">{AUDIENCE_TEXTS.coverageTests}</th>
              <th scope="col">{AUDIENCE_TEXTS.coverageA11y}</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((story) => (
              <tr key={story.id}>
                <th scope="row" className="forgebook-coverage__story">
                  <StoryLink story={story} hrefOf={hrefOf} onOpen={onOpen} className="forgebook-link">
                    {story.name}
                  </StoryLink>
                  {story.description === undefined ? null : (
                    <span className="forgebook-coverage__covers">
                      <CodeText text={story.description} />
                    </span>
                  )}
                </th>
                <td>{story.group === undefined ? "" : groupLabel(storyGroups, story.group)}</td>
                <td>{story.hasPlay ? AUDIENCE_TEXTS.coverageHasPlay : AUDIENCE_TEXTS.coverageNoPlay}</td>
                <td>{isUntested(story) ? AUDIENCE_TEXTS.coverageUntested : AUDIENCE_TEXTS.coverageTested}</td>
                <td>{checkText(checks.get(story.id))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
