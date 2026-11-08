/**
 * The search's results: beside the sidebar, what the words find across the catalogue, each component or docs page with
 * what matched inside it and why, and a key for every move.
 *
 * @remarks
 * Loaded with its style sheet on first use, and it loads the index only when something is typed, so a reader who never
 * searches pays for neither. The focus stays in the search field, as a list that follows the words needs: the arrows
 * move the row `aria-activedescendant` names. Every row is a real link, so a modified press opens a new tab. The results
 * sit beside the tree, which goes on filtering by name: the tree is for browsing what the words leave, this list for
 * going to the exact place.
 *
 * @module
 */
import "./search.scss";

import type { StorySource } from "@forgebook/story-format/source";
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  type SearchAnswer,
  type SearchHit,
  type SearchHitKind,
  type SearchReason,
  type SearchResult,
  type SearchTarget,
  searchables,
  searchCatalogue
} from "../search.ts";
import type { MarkedText } from "../searchMarks.ts";
import type { StoryTree } from "../storyTree.ts";
import { SEARCH_STRINGS } from "./searchStrings.ts";
import { shownTree } from "./treeSearch.ts";
import { useSearchIndex } from "./useSearchIndex.ts";
import { SIDE_BY_SIDE_WIDTH } from "./useSidebarLayout.ts";

/** How much a page shows: what a person reads before refining the words. */
const LIMITS = { results: 24, hits: 3 };

/** The room between the field and the list when the list opens under it, in CSS px. */
const LIST_GAP = 6;

/** The room the list leaves around it, in CSS px. */
const LIST_MARGIN = 8;

/** The list's widest: long enough for a sentence around a match. */
const LIST_WIDTH = "38rem";

/**
 * Where the list sits: beside the sidebar, or under the field on a small window.
 *
 * @param field - where the field is.
 * @param sidebarWidth - the sidebar's width, in CSS px.
 */
const listPlace = (field: DOMRect, sidebarWidth: number): CSSProperties => {
  if (window.innerWidth < SIDE_BY_SIDE_WIDTH)
    return { top: field.bottom + LIST_GAP, insetInline: LIST_MARGIN };
  const start = sidebarWidth + LIST_MARGIN;
  return {
    top: field.top,
    insetInlineStart: start,
    width: `min(${LIST_WIDTH}, calc(100vw - ${start + LIST_MARGIN}px))`
  };
};

/** How far each key moves the highlighted row. */
const KEY_STEPS: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

/** What the search field asks of the list. */
export type SearchPanelKeys = {
  /**
   * Answers a key pressed in the field.
   *
   * @param key - the key.
   * @param hasModifier - whether a key that opens a new tab is held.
   * @returns whether the list used it.
   */
  readonly press: (key: string, hasModifier: boolean) => boolean;
};

/** The list's props. */
export type SearchPanelProps = {
  /** The tree. */
  readonly tree: StoryTree;
  /** The sources, with the loaders of their index. */
  readonly sources: readonly StorySource[];
  /** What was typed. */
  readonly query: string;
  /** Whether the list shows: closed, it stays mounted, so the index and the place are kept. */
  readonly isOpen: boolean;
  /** The search field: the list opens from where it is. */
  readonly field: RefObject<HTMLInputElement | null>;
  /** The sidebar's width, in CSS px. */
  readonly sidebarWidth: number;
  /** Called with the tree's filter, which comes with the list. */
  readonly onFilterReady: (filter: typeof shownTree) => void;
  /** The address of a result. */
  readonly hrefOf: (target: SearchTarget) => string;
  /** Goes to a result. */
  readonly onOpen: (target: SearchTarget) => void;
  /** Called with the highlighted row's element id. */
  readonly onActiveChange: (id: string | undefined) => void;
  /** Filled with what the field asks of the list. */
  readonly keysRef: RefObject<SearchPanelKeys | null>;
  /** The list's element id, for the field's `aria-controls`. */
  readonly id: string;
};

/** The name of each kind of hit. */
const HIT_NAMES: Readonly<Record<SearchHitKind, string>> = {
  prop: SEARCH_STRINGS.hitProp,
  event: SEARCH_STRINGS.hitEvent,
  story: SEARCH_STRINGS.hitStory,
  heading: SEARCH_STRINGS.hitHeading,
  text: SEARCH_STRINGS.hitText,
  description: SEARCH_STRINGS.hitDescription
};

/** A row: a result or one of its hits. */
type Row = {
  /** Its element id. */
  readonly id: string;
  /** What it is, wherever the answer places it: a result and its hit may go to the same page. */
  readonly key: string;
  /** Where it goes. */
  readonly target: SearchTarget;
};

/** Whether a press is a modified one, left to the browser: a new tab or a download. */
const isModified = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0;

/**
 * A text with what matched marked.
 *
 * @param props - the pieces.
 */
const Marked = ({ pieces }: { readonly pieces: readonly MarkedText[] }): ReactNode =>
  pieces.map((piece, place) =>
    // the pieces of a text never move: their place is who they are
    // biome-ignore lint/suspicious/noArrayIndexKey: see above
    piece.isMatch ? <mark key={place}>{piece.text}</mark> : <span key={place}>{piece.text}</span>
  );

/** What a reason says. */
const reasonText = ({ place, means }: SearchReason): string | undefined => {
  if (means !== undefined) return SEARCH_STRINGS.means(means);
  if (place === "keyword") return SEARCH_STRINGS.reasonKeyword;
  return place === "title" ? SEARCH_STRINGS.reasonPlace : undefined;
};

/** A row's link's props. */
type RowLinkProps = Pick<SearchPanelProps, "hrefOf" | "onOpen"> & {
  /** The row. */
  readonly row: Row;
  /** Whether it is highlighted. */
  readonly isActive: boolean;
  /** Highlights it. */
  readonly onActive: () => void;
  /** Its class. */
  readonly className: string;
  /** What it shows. */
  readonly children: ReactNode;
};

/**
 * A row's link.
 *
 * @param props - the row, whether it is highlighted, and how it opens.
 */
const RowLink = ({
  row,
  isActive,
  hrefOf,
  onOpen,
  onActive,
  className,
  children
}: RowLinkProps): ReactNode => (
  // a link and an option: the list is a listbox for the field, and each row stays a link a press can open in a new tab
  <a
    id={row.id}
    role="option"
    tabIndex={-1}
    aria-selected={isActive}
    data-active={isActive ? "" : undefined}
    className={className}
    href={hrefOf(row.target)}
    onPointerMove={onActive}
    onClick={(event: MouseEvent<HTMLAnchorElement>): void => {
      if (isModified(event)) return;
      event.preventDefault();
      onOpen(row.target);
    }}
  >
    {children}
  </a>
);

/**
 * A hit's line: what it is, its name, the words around the match.
 *
 * @param props - the hit.
 */
const HitLine = ({ hit }: { readonly hit: SearchHit }): ReactNode => (
  <>
    <span className="forgebook-result__why">{HIT_NAMES[hit.kind]}</span>
    <span className="forgebook-result__body">
      {hit.label === undefined ? null : (
        <span
          className="forgebook-result__label"
          data-code={hit.kind === "prop" || hit.kind === "event" ? "" : undefined}
        >
          <Marked pieces={hit.label} />
        </span>
      )}
      {hit.snippet.length === 0 ? null : (
        <span className="forgebook-result__snippet">
          <Marked pieces={hit.snippet} />
        </span>
      )}
    </span>
  </>
);

/**
 * A result's own line: its name, where it sits, and why its name is there.
 *
 * @param props - the result.
 */
const ResultLine = ({ result }: { readonly result: SearchResult }): ReactNode => {
  const reasons = result.reasons.flatMap((reason) => reasonText(reason) ?? []);
  return (
    <>
      <span className="forgebook-result__name">
        <Marked pieces={result.name} />
      </span>
      {reasons.map((reason) => (
        <span key={reason} className="forgebook-result__why">
          {reason}
        </span>
      ))}
      <span className="forgebook-result__place">{result.place}</span>
      <span className="forgebook-result__kind">
        {result.kind === "page" ? SEARCH_STRINGS.kindPage : SEARCH_STRINGS.kindComponent}
      </span>
    </>
  );
};

/** A result with its rows. */
type ResultRows = {
  /** The result. */
  readonly result: SearchResult;
  /** Its own row. */
  readonly own: Row;
  /** Its hits, each with its row. */
  readonly hits: readonly { readonly hit: SearchHit; readonly row: Row }[];
};

/**
 * What a result leaves out: how much more is inside it, and the words it does not hold; nothing when it leaves out
 * nothing.
 *
 * @param props - the result, and how many of its hits are listed.
 */
const ResultNote = ({
  result,
  listed
}: {
  readonly result: SearchResult;
  readonly listed: number;
}): ReactNode => {
  const more = result.hitCount - listed;
  if (more === 0 && result.missed.length === 0) return null;
  return (
    <p className="forgebook-result__note">
      {more > 0 ? <span>{SEARCH_STRINGS.more(more)}</span> : null}
      {result.missed.length > 0 ? <span>{SEARCH_STRINGS.missing(result.missed.join(", "))}</span> : null}
    </p>
  );
};

/** The answer's rows, for the keys and the list. */
const useResultRows = (
  answer: SearchAnswer,
  hrefOf: (target: SearchTarget) => string
): readonly ResultRows[] => {
  const baseId = useId();
  return useMemo(
    () =>
      answer.results.map((result, place) => ({
        result,
        own: { id: `${baseId}-${place}`, key: hrefOf(result.target), target: result.target },
        hits: result.hits.map((hit, hitPlace) => ({
          hit,
          row: {
            id: `${baseId}-${place}-${hitPlace}`,
            key: `${hrefOf(result.target)} ${hitPlace}`,
            target: hit.target
          }
        }))
      })),
    [answer, baseId, hrefOf]
  );
};

/** What the highlighted row reads. */
type ActiveRowInput = Pick<SearchPanelProps, "hrefOf" | "onOpen" | "onActiveChange" | "keysRef"> & {
  /** Every row, in order. */
  readonly rows: readonly Row[];
  /** Whether the list shows. */
  readonly isShown: boolean;
  /** The words the rows answer. */
  readonly words: string;
  /** Whether the words typed are newer than the rows, which are drawn after the field. */
  readonly isBehind: boolean;
};

/** A key the list acts on. */
type ListKey = {
  /** Its name. */
  readonly key: string;
  /** Whether it is pressed with Command or Control. */
  readonly hasModifier: boolean;
};

/** The highlighted row: moved by the keys and the pointer, kept in view, named to the field. */
const useActiveRow = ({
  rows,
  isShown,
  words,
  isBehind,
  hrefOf,
  onOpen,
  onActiveChange,
  keysRef
}: ActiveRowInput): {
  readonly active: Row | undefined;
  readonly setActive: (row: Row) => void;
  readonly listRef: RefObject<HTMLDivElement | null>;
} => {
  // what a person chose is a row, not a place: an index that arrives moves the rows, and Enter must open the one chosen.
  // Until they choose, and for new words, it is the first
  const [chosen, setChosen] = useState<{ readonly words: string; readonly key: string }>();
  const chosenPlace = chosen?.words === words ? rows.findIndex((row) => row.key === chosen.key) : -1;
  const place = Math.max(chosenPlace, 0);
  const active = rows[place];
  const setActive = (row: Row): void => setChosen({ words, key: row.key });
  const activeId = isShown ? active?.id : undefined;
  useEffect(() => onActiveChange(activeId), [activeId, onActiveChange]);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeId === undefined) return;
    listRef.current?.querySelector(`[id="${CSS.escape(activeId)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);
  const act = ({ key, hasModifier }: ListKey): boolean => {
    if (activeId === undefined || active === undefined) return false;
    const step = KEY_STEPS[key];
    const next = step === undefined ? undefined : rows[(place + step + rows.length) % rows.length];
    if (next !== undefined) setActive(next);
    else if (key !== "Enter") return false;
    else if (hasModifier) window.open(hrefOf(active.target), "_blank", "noopener");
    else onOpen(active.target);
    return true;
  };
  // a key pressed while the list is behind the words is meant for the list of those words, and waits for it
  const waitingKeys = useRef<ListKey[]>([]);
  useEffect(() => {
    if (isBehind) return;
    const next = waitingKeys.current.shift();
    // one at a time: the next key acts on the row this one moved to, which the next render gives
    if (next !== undefined && !act(next)) waitingKeys.current = [];
  });
  useImperativeHandle(keysRef, () => ({
    press: (key: string, hasModifier: boolean): boolean => {
      const isListKey = key === "Enter" || KEY_STEPS[key] !== undefined;
      if (isListKey && (isBehind || waitingKeys.current.length > 0)) {
        waitingKeys.current.push({ key, hasModifier });
        return true;
      }
      return act({ key, hasModifier });
    }
  }));
  return { active, setActive, listRef };
};

/** The answer's state, in a line: how many results, what is still coming, what could not be read. */
const PanelStatus = ({
  total,
  query,
  isLoading,
  hasFailed,
  corrections
}: {
  readonly total: number;
  readonly query: string;
  readonly isLoading: boolean;
  readonly hasFailed: boolean;
  readonly corrections: SearchAnswer["corrections"];
}): ReactNode => (
  <p className="forgebook-search-panel__status" role="status">
    {total === 0 && !isLoading ? <span>{SEARCH_STRINGS.nothing(query.trim())}</span> : null}
    {total > 0 ? <span>{SEARCH_STRINGS.count(total)}</span> : null}
    {total > 0 && corrections.length > 0 ? (
      <span>{SEARCH_STRINGS.readAs(corrections.map(({ read }) => `“${read}”`).join(", "))}</span>
    ) : null}
    {isLoading ? <span>{SEARCH_STRINGS.reading}</span> : null}
    {hasFailed ? <span>{SEARCH_STRINGS.unreadable}</span> : null}
  </p>
);

/**
 * The search's results.
 *
 * @param props - what was typed, what can be found and how to go to it.
 */
export const SearchPanel = ({
  tree,
  sources,
  query,
  isOpen,
  field,
  sidebarWidth,
  onFilterReady,
  hrefOf,
  onOpen,
  onActiveChange,
  keysRef,
  id
}: SearchPanelProps): ReactNode => {
  useEffect(() => onFilterReady(shownTree), [onFilterReady]);
  // the index is asked for once, by the first words
  const hasQuery = query.trim() !== "";
  const [isWanted, setIsWanted] = useState(hasQuery);
  if (hasQuery && !isWanted) setIsWanted(true);
  const { indexes, isLoading, hasFailed } = useSearchIndex(sources, isWanted);
  const all = useMemo(() => searchables(tree, indexes), [tree, indexes]);
  // the field never waits for a long list
  const words = useDeferredValue(query);
  const answer = useMemo(() => searchCatalogue(all, words, LIMITS), [all, words]);
  const results = useResultRows(answer, hrefOf);
  const rows = useMemo(
    () => results.flatMap(({ own, hits }) => [own, ...hits.map(({ row }) => row)]),
    [results]
  );
  const isShown = isOpen && hasQuery;
  const panelRef = useRef<HTMLElement>(null);
  // in the top layer: the sidebar's own stacking would otherwise leave the list under the page it opens over
  useLayoutEffect(() => {
    if (isShown) panelRef.current?.showPopover();
  }, [isShown]);
  const rect = isShown ? field.current?.closest("label")?.getBoundingClientRect() : undefined;
  const { active, setActive, listRef } = useActiveRow({
    rows,
    isShown,
    words,
    isBehind: words !== query,
    hrefOf,
    onOpen,
    onActiveChange,
    keysRef
  });
  if (!isShown) return null;
  const rowProps = (row: Row): Omit<RowLinkProps, "className" | "children"> => ({
    row,
    hrefOf,
    onOpen,
    isActive: row.id === active?.id,
    onActive: (): void => setActive(row)
  });
  return (
    <section
      ref={panelRef}
      popover="manual"
      className="forgebook-search-panel"
      aria-label={SEARCH_STRINGS.results}
      data-ready={isLoading ? undefined : ""}
      style={rect === undefined ? undefined : listPlace(rect, sidebarWidth)}
      // the focus stays in the field: a press here would take it away and close the list before it opens anything
      onMouseDown={(event: MouseEvent): void => event.preventDefault()}
    >
      <PanelStatus
        total={answer.total}
        query={query}
        isLoading={isLoading}
        hasFailed={hasFailed}
        corrections={answer.corrections}
      />
      <div
        id={id}
        ref={listRef}
        className="forgebook-search-panel__list"
        role="listbox"
        aria-label={SEARCH_STRINGS.results}
      >
        {results.map(({ result, own, hits }) => (
          <div key={own.id} className="forgebook-result">
            <RowLink {...rowProps(own)} className="forgebook-result__own">
              <ResultLine result={result} />
            </RowLink>
            {hits.map(({ hit, row }) => (
              <RowLink key={row.id} {...rowProps(row)} className="forgebook-result__hit">
                <HitLine hit={hit} />
              </RowLink>
            ))}
            <ResultNote result={result} listed={hits.length} />
          </div>
        ))}
      </div>
      <p className="forgebook-search-panel__keys">
        <kbd>↑</kbd>
        <kbd>↓</kbd> {SEARCH_STRINGS.keyMove} <kbd>↵</kbd> {SEARCH_STRINGS.keyOpen} <kbd>esc</kbd>{" "}
        {SEARCH_STRINGS.keyClear}
      </p>
    </section>
  );
};
