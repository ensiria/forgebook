/**
 * A list of messages with actions behind each row: a finger swipes a row left for Snooze and Archive (all the way to
 * archive it) or right to mark it read; a mouse opens the same actions from the row's menu button, which shows only
 * where there is a hover. Rows scroll up and down as usual (`touch-action: pan-y`).
 *
 * @module
 */
import "./touchDemos.scss";

import { type PointerEvent, type ReactNode, useRef, useState } from "react";

/** A message of the list. */
type Message = {
  /** Its id. */
  readonly id: number;
  /** Who sent it. */
  readonly from: string;
  /** Its subject. */
  readonly subject: string;
  /** Whether it was read. */
  readonly isRead: boolean;
};

/** A drag under way: where it began, the row's offset then, and whether it goes sideways (none until it is clear). */
type RowDrag = {
  /** Where the finger went down, sideways. */
  readonly startX: number;
  /** Where it went down, up and down. */
  readonly startY: number;
  /** The row's offset when it began. */
  readonly base: number;
  /** Whether the drag goes sideways; none until it moved enough to tell. */
  isHorizontal: boolean | undefined;
};

/** Invented messages. */
const MESSAGES: readonly Message[] = [
  { id: 1, from: "Ada", subject: "Quarterly planning, first draft", isRead: false },
  { id: 2, from: "Bruno", subject: "Photos from the offsite", isRead: false },
  { id: 3, from: "Chiara", subject: "Invoice 2026-114", isRead: true },
  { id: 4, from: "Dario", subject: "Can we move Thursday's call?", isRead: false },
  { id: 5, from: "Elena", subject: "New logo, three options", isRead: true },
  { id: 6, from: "Fabio", subject: "Release notes for 4.2", isRead: false },
  { id: 7, from: "Giulia", subject: "Lunch on Friday?", isRead: true },
  { id: 8, from: "Hugo", subject: "Contract, last comments", isRead: false }
];

/** How far the end actions open, in CSS px. */
const END_WIDTH = 160;

/** How far the start action opens, in CSS px. */
const START_WIDTH = 88;

/** A swipe past this, in CSS px, archives the row at once. */
const FULL_SWIPE = 240;

/**
 * One row, its drag and its actions.
 *
 * @param props - the message, and what archiving it and marking it do.
 */
const Row = ({
  message,
  onArchive,
  onToggleRead
}: {
  readonly message: Message;
  readonly onArchive: () => void;
  readonly onToggleRead: () => void;
}): ReactNode => {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const drag = useRef<RowDrag>(undefined);
  const settle = (to: number): void => {
    setIsDragging(false);
    setOffset(to);
  };
  const down = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.pointerType === "mouse") return;
    drag.current = { startX: event.clientX, startY: event.clientY, base: offset, isHorizontal: undefined };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>): void => {
    const current = drag.current;
    if (current === undefined) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    current.isHorizontal ??= Math.abs(dx) > 6 || Math.abs(dy) > 6 ? Math.abs(dx) > Math.abs(dy) : undefined;
    if (current.isHorizontal !== true) return;
    setIsDragging(true);
    setOffset(Math.max(-FULL_SWIPE - 40, Math.min(START_WIDTH + 40, current.base + dx)));
  };
  const up = (): void => {
    if (drag.current === undefined) return;
    drag.current = undefined;
    if (offset <= -FULL_SWIPE) {
      settle(-1000);
      window.setTimeout(onArchive, 200);
    } else if (offset < -END_WIDTH / 2) settle(-END_WIDTH);
    else if (offset > START_WIDTH / 2) {
      settle(0);
      onToggleRead();
    } else settle(0);
  };
  return (
    <li className="swipe-row" data-read={message.isRead ? "" : undefined}>
      <div className="swipe-row__start" aria-hidden="true">
        {message.isRead ? "Unread" : "Read"}
      </div>
      <div className="swipe-row__end" aria-hidden="true">
        <button type="button" className="swipe-row__snooze" tabIndex={-1} onClick={(): void => settle(0)}>
          Snooze
        </button>
        <button type="button" className="swipe-row__archive" tabIndex={-1} onClick={onArchive}>
          Archive
        </button>
      </div>
      <div
        className="swipe-row__content"
        data-dragging={isDragging ? "" : undefined}
        style={{ translate: `${offset}px 0` }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={(): void => settle(0)}
      >
        <span className="swipe-row__from">{message.from}</span>
        <span className="swipe-row__subject">{message.subject}</span>
        <button
          type="button"
          className="swipe-row__menu-button"
          aria-label={`Actions for ${message.subject}`}
          aria-expanded={isMenuOpen}
          onClick={(): void => setIsMenuOpen(!isMenuOpen)}
        >
          ⋯
        </button>
        {isMenuOpen ? (
          <div className="swipe-row__menu" role="menu">
            <button type="button" role="menuitem" onClick={onToggleRead}>
              {message.isRead ? "Mark unread" : "Mark read"}
            </button>
            <button type="button" role="menuitem" onClick={(): void => setIsMenuOpen(false)}>
              Snooze
            </button>
            <button type="button" role="menuitem" onClick={onArchive}>
              Archive
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
};

/** The list's props. */
export type SwipeListProps = {
  /** The list's heading. */
  readonly title: string;
};

/**
 * A list of messages with swipe actions.
 *
 * @param props - the list's props.
 */
export const SwipeList = ({ title }: SwipeListProps): ReactNode => {
  const [messages, setMessages] = useState<readonly Message[]>(MESSAGES);
  return (
    <section className="touch-demo swipe-list">
      <header className="touch-demo__header">
        <h3>{title}</h3>
        <button type="button" className="touch-demo__reset" onClick={(): void => setMessages(MESSAGES)}>
          Reset
        </button>
      </header>
      <ul className="swipe-list__rows">
        {messages.map((message) => (
          <Row
            key={message.id}
            message={message}
            onArchive={(): void => setMessages((current) => current.filter((each) => each.id !== message.id))}
            onToggleRead={(): void =>
              setMessages((current) =>
                current.map((each) => (each.id === message.id ? { ...each, isRead: !each.isRead } : each))
              )
            }
          />
        ))}
      </ul>
      {messages.length === 0 ? <p className="touch-demo__empty">Inbox zero.</p> : null}
    </section>
  );
};
