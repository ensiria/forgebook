/**
 * A feed that refreshes when it is pulled down from its top: a finger pulls past the line and lets go, a spinner
 * turns and a new post arrives; a mouse uses the Refresh button, which shows only where there is a hover.
 *
 * @remarks
 * The pull is read from touch events, as phones' feeds read it: at the top, the first downward `touchmove` is
 * cancelled, so the page does not scroll and the pull is the feed's (a listener of its own, since React's touch
 * listeners cannot cancel).
 *
 * @module
 */
import "./touchDemos.scss";

import { type ReactNode, useEffect, useRef, useState } from "react";

/** How far to pull, in CSS px, before letting go refreshes. */
const THRESHOLD = 70;

/** How long a refresh takes, in ms. */
const REFRESH_MS = 900;

/** Invented posts. */
const POSTS: readonly string[] = [
  "Ada shared a photo from the lake",
  "Bruno is going to the concert on Saturday",
  "Chiara posted three new drawings",
  "Dario finished the marathon",
  "Elena recommends a book",
  "Fabio moved to Turin",
  "Giulia's bakery opens tomorrow",
  "Hugo is looking for a flatmate"
];

/** The feed's props. */
export type PullToRefreshProps = {
  /** The feed's heading. */
  readonly title: string;
};

/**
 * A feed pulled to refresh.
 *
 * @param props - the feed's props.
 */
export const PullToRefresh = ({ title }: PullToRefreshProps): ReactNode => {
  const listRef = useRef<HTMLUListElement>(null);
  const [pull, setPull] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [posts, setPosts] = useState<readonly string[]>(POSTS);
  const fresh = useRef(0);
  const refresh = (): void => {
    setIsRefreshing(true);
    window.setTimeout(() => {
      fresh.current += 1;
      setPosts((current) => [`New post ${fresh.current}: just now`, ...current]);
      setIsRefreshing(false);
    }, REFRESH_MS);
  };
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    let startY: number | undefined;
    let pulled = 0;
    const touchStart = (event: TouchEvent): void => {
      startY = list.scrollTop === 0 ? event.touches[0]?.clientY : undefined;
    };
    const touchMove = (event: TouchEvent): void => {
      const y = event.touches[0]?.clientY;
      if (startY === undefined || y === undefined || y < startY) return;
      // the pull is the feed's, not the page's scroll
      if (event.cancelable) event.preventDefault();
      pulled = Math.min(140, (y - startY) * 0.6);
      setPull(pulled);
    };
    const touchEnd = (): void => {
      if (startY !== undefined && pulled >= THRESHOLD) refreshRef.current();
      startY = undefined;
      pulled = 0;
      setPull(0);
    };
    list.addEventListener("touchstart", touchStart, { passive: true });
    list.addEventListener("touchmove", touchMove, { passive: false });
    list.addEventListener("touchend", touchEnd);
    list.addEventListener("touchcancel", touchEnd);
    return (): void => {
      list.removeEventListener("touchstart", touchStart);
      list.removeEventListener("touchmove", touchMove);
      list.removeEventListener("touchend", touchEnd);
      list.removeEventListener("touchcancel", touchEnd);
    };
  }, []);
  const isArmed = pull >= THRESHOLD;
  return (
    <section className="touch-demo pull-feed">
      <header className="touch-demo__header">
        <h3>{title}</h3>
        <button type="button" className="pull-feed__refresh" disabled={isRefreshing} onClick={refresh}>
          Refresh
        </button>
      </header>
      <div className="pull-feed__indicator" style={{ height: isRefreshing ? 48 : pull }} aria-live="polite">
        {isRefreshing ? (
          <>
            <span className="pull-feed__spinner" aria-hidden="true" />
            <span className="touch-demo__hidden">Refreshing</span>
          </>
        ) : null}
        {!isRefreshing && pull > 0 ? <span>{isArmed ? "Release to refresh" : "Pull to refresh"}</span> : null}
      </div>
      <ul ref={listRef} className="pull-feed__list">
        {posts.map((post) => (
          <li key={post}>{post}</li>
        ))}
      </ul>
    </section>
  );
};
