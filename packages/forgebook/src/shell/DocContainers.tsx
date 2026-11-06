/**
 * The blocks of a docs page that hold others: an aside, tabs, steps, cards and a link card, each given what it holds
 * already drawn.
 *
 * @remarks
 * Part of the docs pages' chunk, loaded with the first page or written home that opens, so the shell's first load pays
 * nothing for them. Each is HTML and the catalogue's style sheet, but the tabs, whose few lines of script pick a panel
 * and move between tabs with the arrow keys as a tab list does. A panel that is not shown stays in the page, hidden, so a
 * story in it loads only once its tab is picked, and keeps its frame after.
 *
 * @module
 */
import { type KeyboardEvent, type MouseEvent, type ReactNode, useId, useRef } from "react";

import type { AsideTone } from "../docPages.ts";
import { Icon } from "./icons.tsx";
import { PAGE_STRINGS } from "./pageStrings.ts";
import { useSyncedTab } from "./useSyncedTab.ts";

/**
 * A remark set apart, its tone in its colour and its title.
 *
 * @param props - its tone, its title (its tone's name when none), and what it holds.
 */
export const AsideBlock = ({
  tone,
  title,
  children
}: {
  readonly tone: AsideTone;
  readonly title: string | undefined;
  readonly children: ReactNode;
}): ReactNode => {
  const id = useId();
  return (
    // a note in the text, never a landmark of the page: a page repeats "Tip", and landmarks must differ by name
    <aside className="forgebook-aside" role="note" data-tone={tone} aria-labelledby={id}>
      <p id={id} className="forgebook-aside__title">
        {title ?? PAGE_STRINGS.asides[tone]}
      </p>
      {children}
    </aside>
  );
};

/**
 * The tab a key moves to in a tab list: the next or the one before, round the ends, or the first or the last.
 *
 * @param key - the key pressed.
 * @param shown - the place of the tab shown.
 * @param count - how many tabs there are.
 * @returns the place to move to; none for a key that moves nowhere.
 */
const keyedTab = (key: string, shown: number, count: number): number | undefined => {
  if (key === "ArrowRight") return (shown + 1) % count;
  if (key === "ArrowLeft") return (shown - 1 + count) % count;
  if (key === "Home") return 0;
  return key === "End" ? count - 1 : undefined;
};

/**
 * Panels of which one shows at a time, behind a tab list.
 *
 * @param props - the tabs' labels, the name they share their choice under, and each panel drawn.
 */
export const TabsBlock = ({
  labels,
  sync,
  panels
}: {
  readonly labels: readonly string[];
  readonly sync: string | undefined;
  readonly panels: readonly ReactNode[];
}): ReactNode => {
  const id = useId();
  const [shown, pick] = useSyncedTab(labels, sync);
  const list = useRef<HTMLDivElement>(null);
  const move = (event: KeyboardEvent<HTMLDivElement>): void => {
    const target = keyedTab(event.key, shown, labels.length);
    if (target === undefined) return;
    event.preventDefault();
    pick(target);
    list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target]?.focus();
  };
  return (
    <div className="forgebook-tabs">
      <div ref={list} className="forgebook-tabs__list" role="tablist" onKeyDown={move}>
        {labels.map((label, place) => (
          <button
            // a set's tabs never reorder, and two may share a label
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            key={place}
            type="button"
            role="tab"
            id={`${id}-tab-${place}`}
            className="forgebook-tabs__tab"
            aria-selected={place === shown}
            aria-controls={`${id}-panel-${place}`}
            tabIndex={place === shown ? 0 : -1}
            onClick={(): void => pick(place)}
          >
            {label}
          </button>
        ))}
      </div>
      {panels.map((panel, place) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: the panels follow their tabs
          key={place}
          role="tabpanel"
          id={`${id}-panel-${place}`}
          aria-labelledby={`${id}-tab-${place}`}
          className="forgebook-tabs__panel"
          hidden={place !== shown}
        >
          {panel}
        </div>
      ))}
    </div>
  );
};

/**
 * Numbered steps, each drawn as a list item with what it holds.
 *
 * @param props - each step drawn.
 */
export const StepsBlock = ({ steps }: { readonly steps: readonly ReactNode[] }): ReactNode => (
  <ol className="forgebook-steps">
    {steps.map((step, place) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: steps never reorder
      <li key={place} className="forgebook-steps__step">
        {step}
      </li>
    ))}
  </ol>
);

/**
 * Cards side by side, as many to a row as fit.
 *
 * @param props - the cards drawn.
 */
export const CardsBlock = ({ children }: { readonly children: ReactNode }): ReactNode => (
  <div className="forgebook-cards">{children}</div>
);

/**
 * A card with a title and what it holds.
 *
 * @param props - its title and what it holds.
 */
export const CardBlock = ({
  title,
  children
}: {
  readonly title: string;
  readonly children: ReactNode;
}): ReactNode => (
  <section className="forgebook-card" aria-label={title === "" ? undefined : title}>
    {title === "" ? null : <p className="forgebook-card__title">{title}</p>}
    {children}
  </section>
);

/**
 * A card that links somewhere: a page of the catalogue opens in place, another site in a new tab.
 *
 * @param props - its title, its description, its address, and how the catalogue opens one of its own.
 */
export const LinkCardBlock = ({
  title,
  description,
  href,
  onOpen
}: {
  readonly title: string;
  readonly description: string | undefined;
  readonly href: string;
  readonly onOpen: (href: string) => boolean;
}): ReactNode => {
  const isOther = /^(https?:|mailto:)/i.test(href);
  return (
    <a
      className="forgebook-card forgebook-card--link"
      href={href}
      {...(isOther ? { target: "_blank", rel: "noreferrer" } : {})}
      onClick={(event: MouseEvent<HTMLAnchorElement>): void => {
        if (isOther || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        if (onOpen(href)) event.preventDefault();
      }}
    >
      <span className="forgebook-card__title">
        {title}
        <Icon name={isOther ? "external" : "chevronRight"} size={12} />
      </span>
      {description === undefined ? null : <span className="forgebook-card__description">{description}</span>}
    </a>
  );
};
