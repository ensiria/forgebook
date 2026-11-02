/**
 * The View menu's panel, loaded the first time the menu opens: every control the person did not hide in it, in their order, each with its value, a handle to move
 * it, a pin that puts it on the toolbar and a button that hides it here (a pinned one stays on the toolbar); at its
 * foot the hidden controls, the wrap choice, the values' reset and the toolbar's reset.
 *
 * @remarks
 * The order is set here only, and the toolbar shows the pinned controls in it: nothing is dragged on the toolbar. A row
 * follows the pointer one to one while it is dragged, and the others move out of its way animated; with the keyboard,
 * the handle moves its row with the arrow keys and the new position is announced.
 *
 * @module
 */
import {
  type ChangeEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from "react";

import type { AudienceId } from "../audiences.ts";
import type { ViewSwitch } from "../switches.ts";
import type { PlacedControl } from "../toolbarLayout.ts";
import { DEFAULT_VIEW, hasViewChanges, type ViewState } from "../viewState.ts";
import { ControlRow } from "./ControlRow.tsx";
import { useCatalogue } from "./catalogueContext.ts";
import { Icon } from "./icons.tsx";
import { NamedViews } from "./NamedViews.tsx";
import { STRINGS } from "./strings.ts";
import { type ControlContext, controlLabel, ToolbarControl } from "./ToolbarControl.tsx";
import type { ToolbarLayout } from "./useToolbarLayout.ts";

/** The room the menu keeps from the window's right edge, in CSS px. */
const EDGE_PX = 12;

/** How long the rows take to move out of a dragged row's way, in ms: the shell's `$duration-quick`. */
const SHIFT_MS = 150;

/** How they move: the shell's `$ease-out`, decelerating. */
const SHIFT_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * The view with the given controls' values back at their defaults.
 *
 * @param view - the view.
 * @param switches - the catalogue's switches.
 * @param ids - the controls' ids.
 * @param defaultAudience - the audience the catalogue starts with.
 */
const withDefaults = (
  view: ViewState,
  switches: readonly ViewSwitch[],
  ids: readonly string[],
  defaultAudience: AudienceId
): ViewState => ({
  ...view,
  switches: {
    ...view.switches,
    ...Object.fromEntries(
      switches.filter((each) => ids.includes(each.id)).map((each) => [each.id, each.default])
    )
  },
  backdrop: ids.includes("backdrop") ? DEFAULT_VIEW.backdrop : view.backdrop,
  sheets: ids.includes("sheets") ? DEFAULT_VIEW.sheets : view.sheets,
  text: ids.includes("text") ? DEFAULT_VIEW.text : view.text,
  audience: ids.includes("audience") ? defaultAudience : view.audience
});

/** A row being dragged: which, where the pointer and the row were when it was grabbed, and where the pointer is. */
type Drag = {
  readonly id: string;
  readonly startY: number;
  readonly startTop: number;
  pointerY: number;
};

/**
 * Moves the rows out of the way animated when the order changes: each row starts from where it was drawn and slides
 * to its new place (the dragged row aside, which follows the pointer); without motion they jump.
 *
 * @param list - the list.
 * @param order - the rows' ids in their order.
 * @param draggedId - the dragged row's id, if one is dragged.
 */
const useShiftedRows = (
  list: RefObject<HTMLOListElement | null>,
  order: string,
  draggedId: string | undefined
): void => {
  const tops = useRef(new Map<string, number>());
  // biome-ignore lint/correctness/useExhaustiveDependencies: the rows are measured again whenever their order changes
  useLayoutEffect(() => {
    const rows = [...(list.current?.querySelectorAll<HTMLElement>("[data-control]") ?? [])];
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const row of rows) {
      const id = row.dataset["control"] ?? "";
      const before = tops.current.get(id);
      tops.current.set(id, row.offsetTop);
      if (before === undefined || id === draggedId || isReduced) continue;
      // where the row is drawn now: its last place plus what a running move still shifts it by
      const shift = new DOMMatrixReadOnly(getComputedStyle(row).transform).m42;
      const start = before + shift - row.offsetTop;
      for (const running of row.getAnimations()) running.cancel();
      if (start === 0) continue;
      row.animate([{ transform: `translateY(${start}px)` }, { transform: "translateY(0)" }], {
        duration: SHIFT_MS,
        easing: SHIFT_EASING
      });
    }
  }, [order]);
};

/**
 * The controls hidden in the menu, at its foot: their count, which opens them as rows like the others, each one usable
 * while it stays hidden, with its pin (a hidden control may still sit on the toolbar) and a button that shows it
 * again in its place.
 *
 * @param props - the hidden controls, the arrangement, and what every control shares.
 */
const HiddenControls = ({
  hidden,
  layout,
  ...context
}: ControlContext & {
  readonly hidden: readonly PlacedControl[];
  readonly layout: ToolbarLayout;
}): ReactNode => {
  const [isOpen, setIsOpen] = useState(false);
  const listId = useId();
  if (hidden.length === 0) return null;
  return (
    <div className="forgebook-hidden-controls">
      <button
        type="button"
        className="forgebook-text-button"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={(): void => setIsOpen(!isOpen)}
      >
        {STRINGS.hiddenControls(hidden.length, hidden.filter((each) => each.isPinned).length)}
        <Icon name={isOpen ? "chevronDown" : "chevronRight"} size={12} />
      </button>
      {isOpen ? (
        <ul id={listId} className="forgebook-arrange-list">
          {hidden.map(({ control, isPinned }) => {
            const label = controlLabel(control);
            return (
              <li key={control.id} className="forgebook-arrange" data-control={control.id} data-hidden="">
                {/* no handle: shown again, it takes back its place in the order */}
                <span className="forgebook-arrange__no-handle" />
                <span className="forgebook-popover__label">{label}</span>
                <div className="forgebook-arrange__control">
                  <ToolbarControl control={control} form="row" {...context} />
                </div>
                <button
                  type="button"
                  className="forgebook-icon-button"
                  aria-label={STRINGS.pinControl(label)}
                  title={STRINGS.pinControl(label)}
                  aria-pressed={isPinned}
                  onClick={(): void => layout.pin(control.id, !isPinned)}
                >
                  <Icon name="pin" size={14} />
                </button>
                <button
                  type="button"
                  className="forgebook-icon-button"
                  aria-label={STRINGS.showControl(label)}
                  title={STRINGS.showControl(label)}
                  onClick={(): void => layout.hide(control.id, false)}
                >
                  <Icon name="eye" size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};

/** What the panel is given. */
export type ViewMenuPanelProps = ControlContext & {
  readonly layout: ToolbarLayout;
  /** The person's own view, without what the story fixes: a value the story fixes is not a change of theirs. */
  readonly ownView: ViewState;
  /** The ids of the controls whose values the menu answers for. */
  readonly ids: readonly string[];
  /** The pinned controls the bar has no room for now: listed here as pinned, shown here until there is room. */
  readonly movedIds: readonly string[];
  /** The popover's panel element. */
  readonly panelRef: RefObject<HTMLDivElement | null>;
  /** The panel's id, the button's `aria-controls`. */
  readonly panelId: string;
};

/**
 * The View menu's panel.
 *
 * @param props - the arrangement, the menu's controls and what every control shares.
 */
export const ViewMenuPanel = ({
  layout,
  ownView,
  ids,
  movedIds,
  panelRef,
  panelId,
  ...context
}: ViewMenuPanelProps): ReactNode => {
  const catalogue = useCatalogue();
  const { switches } = catalogue;
  const listRef = useRef<HTMLOListElement>(null);
  const drag = useRef<Drag | undefined>(undefined);
  const [draggedId, setDraggedId] = useState<string | undefined>(undefined);
  const [announced, setAnnounced] = useState("");
  const hintId = useId();
  const shown = layout.placed.filter((each) => !each.isHidden);
  const hidden = layout.placed.filter((each) => each.isHidden);
  const order = shown.map((each) => each.control.id).join(",");
  useShiftedRows(listRef, order, draggedId);
  // the menu never runs past the window's edges: a narrow window keeps it inside, its widest values then scroll; a
  // short one scrolls its rows, the foot staying in sight
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (panel === null) return;
    const keepInside = (): void => {
      const box = panel.getBoundingClientRect();
      panel.style.maxWidth = `${window.innerWidth - box.left - EDGE_PX}px`;
      panel.style.maxHeight = `${window.innerHeight - box.top - EDGE_PX}px`;
    };
    keepInside();
    window.addEventListener("resize", keepInside);
    return (): void => window.removeEventListener("resize", keepInside);
  }, [panelRef]);

  /** Keeps the dragged row under the pointer, from where its row is drawn now. */
  const follow = (): void => {
    const current = drag.current;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-control="${current?.id}"]`);
    if (current === undefined || row === null || row === undefined) return;
    const offset = current.pointerY - current.startY - (row.offsetTop - current.startTop);
    row.style.transform = `translateY(${offset}px)`;
  };
  // after a move, the dragged row is drawn at its new place: it stays under the pointer
  // biome-ignore lint/correctness/useExhaustiveDependencies: follows each new order while a row is dragged
  useLayoutEffect(follow, [order]);

  /** The list's rows as they are drawn now. */
  const rowsNow = (): HTMLElement[] => [
    ...(listRef.current?.querySelectorAll<HTMLElement>("[data-control]") ?? [])
  ];

  /**
   * Where the dragged row goes: past every other row whose middle its own middle passed, both read from the layout
   * (never from how a running move draws them, which would move the target under the pointer and back).
   *
   * @param id - the dragged row's id.
   * @param current - the drag.
   */
  const targetIndex = (id: string, current: Drag): number => {
    const rows = rowsNow();
    const row = rows.find((each) => each.dataset["control"] === id);
    if (row === undefined) return 0;
    const center = current.startTop + (current.pointerY - current.startY) + row.offsetHeight / 2;
    return rows.filter((each) => each !== row && center > each.offsetTop + each.offsetHeight / 2).length;
  };

  // a menu closed while a row is dragged ends the drag
  const stopDrag = useRef<(() => void) | undefined>(undefined);
  useEffect(() => (): void => stopDrag.current?.(), []);

  const grab = (event: PointerEvent<HTMLButtonElement>, id: string): void => {
    const row = event.currentTarget.closest<HTMLElement>("[data-control]");
    if (row === null || event.button !== 0) return;
    // no text selection while dragging; the handle still takes the focus, so the arrow keys move its row next
    event.preventDefault();
    event.currentTarget.focus();
    window.getSelection()?.removeAllRanges();
    drag.current = { id, startY: event.clientY, startTop: row.offsetTop, pointerY: event.clientY };
    setDraggedId(id);
    // the window, not the handle, follows the pointer: moving the row in the page takes the handle's pointer capture
    // away, and the release would never arrive
    const moveTo = (moved: globalThis.PointerEvent): void => {
      const current = drag.current;
      if (current === undefined) return;
      current.pointerY = moved.clientY;
      follow();
      const index = targetIndex(id, current);
      if (index !== rowsNow().findIndex((each) => each.dataset["control"] === id)) layout.move(id, index);
    };
    const drop = (): void => {
      window.removeEventListener("pointermove", moveTo);
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", drop);
      stopDrag.current = undefined;
      drag.current = undefined;
      setDraggedId(undefined);
      // the row settles into its place from where the pointer left it
      const dropped = rowsNow().find((each) => each.dataset["control"] === id);
      if (dropped === undefined) return;
      const from = dropped.style.transform;
      dropped.style.transform = "";
      if (from !== "" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
        dropped.animate([{ transform: from }, { transform: "translateY(0)" }], {
          duration: SHIFT_MS,
          easing: SHIFT_EASING
        });
    };
    stopDrag.current = drop;
    window.addEventListener("pointermove", moveTo);
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);
  };

  return (
    <div
      ref={panelRef}
      id={panelId}
      className="forgebook-popover forgebook-popover--arrange"
      role="dialog"
      aria-label={STRINGS.view}
    >
      {/* the rows scroll between the views and the foot, which stays in sight: the menu fits the window */}
      <div className="forgebook-popover__body">
        <NamedViews view={context.view} ownView={ownView} onViewChange={context.onViewChange} />
        <ol
          ref={listRef}
          className="forgebook-arrange-list"
          data-dragging={draggedId === undefined ? undefined : ""}
        >
          {shown.map((each, index) => (
            <ControlRow
              key={each.control.id}
              each={each}
              index={index}
              count={shown.length}
              isDragged={each.control.id === draggedId}
              isMoved={movedIds.includes(each.control.id)}
              isChanged={hasViewChanges(ownView, switches, [each.control.id], catalogue.audience)}
              layout={layout}
              hintId={hintId}
              onGrab={grab}
              onAnnounce={setAnnounced}
              {...context}
            />
          ))}
        </ol>
        <span id={hintId} className="forgebook-visually-hidden">
          {STRINGS.moveControlHint}
        </span>
        <span className="forgebook-visually-hidden" aria-live="polite">
          {announced}
        </span>
        <HiddenControls hidden={hidden} layout={layout} {...context} />
        <label className="forgebook-wrap-choice">
          <input
            type="checkbox"
            role="switch"
            aria-checked={layout.isWrapped}
            className="forgebook-switch"
            checked={layout.isWrapped}
            onChange={(event: ChangeEvent<HTMLInputElement>): void =>
              layout.setIsWrapped(event.currentTarget.checked)
            }
          />
          {STRINGS.wrapToolbar}
        </label>
      </div>
      <div className="forgebook-popover__foot">
        <button
          type="button"
          className="forgebook-text-button"
          onClick={(): void =>
                context.onViewChange(withDefaults(context.view, switches, ids, catalogue.audience))
              }
        >
          {STRINGS.resetView}
        </button>
        <button
          type="button"
          className="forgebook-text-button"
          title={STRINGS.toolbarInBrowser}
          disabled={!layout.isArranged}
          onClick={layout.reset}
        >
          {STRINGS.resetToolbar}
        </button>
        <span className="forgebook-popover__note">{STRINGS.viewInAddress}</span>
      </div>
    </div>
  );
};
