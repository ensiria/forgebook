/**
 * The sidebar's search field: `/` or the platform's search key comes here from anywhere in the shell, and what is typed
 * filters the tree at once and opens the results beside it (`SearchPanel.tsx`), loaded the first time the field is used.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";
import {
  type ChangeEvent,
  type KeyboardEvent,
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState
} from "react";

import type { SearchTarget } from "../search.ts";
import type { StoryTree } from "../storyTree.ts";
import { Icon } from "./icons.tsx";
import { isTyping } from "./keyboard.ts";
import type { SearchPanelKeys } from "./SearchPanel.tsx";
import { STRINGS } from "./strings.ts";
import type { shownTree } from "./treeSearch.ts";

/** The results, loaded on first use: most visits never search. */
const SearchPanel = lazy(() =>
  import("./SearchPanel.tsx").then(
    (module) => ({ default: module.SearchPanel }),
    // a chunk gone after a new deployment must not take the page with it: the field simply finds nothing more
    () => ({ default: (): ReactNode => null })
  )
);

/** The field's props. */
export type SidebarSearchProps = {
  /** What is typed: the tree filters by it. */
  readonly query: string;
  /** Called when it changes. */
  readonly onQueryChange: (query: string) => void;
  /** Called with the tree's filter, which comes with the list. */
  readonly onFilterReady: (filter: typeof shownTree) => void;
  /** The tree. */
  readonly tree: StoryTree;
  /** The sources, with the loaders of their index. */
  readonly sources: readonly StorySource[];
  /** The sidebar's width, in CSS px. */
  readonly sidebarWidth: number;
  /** Whether the sidebar is shown: hidden, it leaves `/` to the page. */
  readonly isSidebarOpen: boolean;
  /** Shows a hidden sidebar: the platform's search key must reach the field wherever it is. */
  readonly onShowSidebar: () => void;
  /** The address of a result. */
  readonly searchHref: (target: SearchTarget) => string;
  /** Goes to a result. */
  readonly onOpenResult: (target: SearchTarget) => void;
};

/**
 * The search field.
 *
 * @param props - what is typed, what can be found and how to go to it.
 */
export const SidebarSearch = ({
  query,
  onQueryChange,
  onFilterReady,
  tree,
  sources,
  sidebarWidth,
  isSidebarOpen,
  onShowSidebar,
  searchHref,
  onOpenResult
}: SidebarSearchProps): ReactNode => {
  const inputRef = useRef<HTMLInputElement>(null);
  const keysRef = useRef<SearchPanelKeys | null>(null);
  const [isUsed, setIsUsed] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const listId = useId();
  // the sidebar is still out of the tab order when its search key shows it: the focus follows once it is back
  const isFocusWaiting = useRef(false);

  useEffect(() => {
    if (!isSidebarOpen || !isFocusWaiting.current) return;
    isFocusWaiting.current = false;
    inputRef.current?.focus();
  }, [isSidebarOpen]);
  useEffect(() => {
    const focusSearch = (event: globalThis.KeyboardEvent): void => {
      const isSearchKey = event.key === "k" && (event.metaKey || event.ctrlKey) && !event.altKey;
      if (isSearchKey) {
        event.preventDefault();
        if (isSidebarOpen) inputRef.current?.focus();
        else {
          isFocusWaiting.current = true;
          onShowSidebar();
        }
        return;
      }
      // "/" goes to the search from anywhere in the shell, as in most catalogues
      // a hidden sidebar leaves the key to the page
      if (!isSidebarOpen) return;
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target))
        return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", focusSearch);
    return (): void => document.removeEventListener("keydown", focusSearch);
  }, [isSidebarOpen, onShowSidebar]);

  const openResult = (target: SearchTarget): void => {
    setIsListOpen(false);
    onOpenResult(target);
    inputRef.current?.blur();
  };

  return (
    <>
      <label className="forgebook-search">
        <Icon name="search" size={14} />
        <input
          type="search"
          ref={inputRef}
          value={query}
          aria-controls={isListOpen ? listId : undefined}
          aria-activedescendant={activeId}
          onFocus={(): void => {
            setIsUsed(true);
            setIsListOpen(true);
          }}
          onBlur={(): void => setIsListOpen(false)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>): void => {
            // Enter confirms what an input method is composing, never a result
            if (event.nativeEvent.isComposing) return;
            if (keysRef.current?.press(event.key, event.metaKey || event.ctrlKey) === true) {
              event.preventDefault();
              return;
            }
            // Escape empties the search first, then leaves the field
            if (event.key !== "Escape") return;
            if (query === "") event.currentTarget.blur();
            else onQueryChange("");
          }}
          placeholder={STRINGS.searchPlaceholder}
          aria-label={STRINGS.searchLabel}
          onChange={(event: ChangeEvent<HTMLInputElement>): void => {
            onQueryChange(event.target.value);
            setIsListOpen(true);
          }}
        />
        {query === "" ? (
          // the key that comes here; the field's own name (aria-label) says what it is
          <kbd className="forgebook-search__key">/</kbd>
        ) : (
          // the catalogue's own clear button: the platform's draws in its own colours and size
          <button
            type="button"
            className="forgebook-search__clear"
            aria-label={STRINGS.clearSearch}
            title={STRINGS.clearSearch}
            onClick={(): void => {
              onQueryChange("");
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" size={10} />
          </button>
        )}
      </label>
      {isUsed ? (
        // the field works before the list arrives: the tree filters meanwhile
        <Suspense fallback={null}>
          <SearchPanel
            id={listId}
            tree={tree}
            sources={sources}
            query={query}
            isOpen={isListOpen}
            field={inputRef}
            sidebarWidth={sidebarWidth}
            onFilterReady={onFilterReady}
            hrefOf={searchHref}
            onOpen={openResult}
            onActiveChange={setActiveId}
            keysRef={keysRef}
          />
        </Suspense>
      ) : null}
    </>
  );
};
