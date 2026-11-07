/**
 * A list to search: a text field that narrows its options, walked with the arrow keys, as a combobox for screen readers.
 * For many options, and for the source's named values and the catalogue's tokens, where a name is what a reader knows.
 *
 * @remarks
 * The list opens in the flow rather than over the panel: the panel scrolls, and would cut an overlay at its edge.
 *
 * @module
 */
import {
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useId,
  useMemo,
  useState
} from "react";

import { EDITOR_STRINGS } from "./editorStrings.ts";

/** One option of the list. */
export type SearchOption = {
  /** What choosing it gives. */
  readonly value: string;
  /** What it is called. */
  readonly label: string;
  /** What it holds, beside its name; none by default. */
  readonly hint?: string;
  /** A colour to show beside its name; none by default. */
  readonly swatch?: string;
};

/** The row that takes the value away: a value no option holds, since an option's comes from a name. */
const CLEAR_ROW = "\0clear";

/** The most options drawn at once: the rest are a search away. */
const MOST_SHOWN = 100;

/** The list's props. */
export type SearchSelectProps = {
  /** The field's name. */
  readonly label: string;
  /** The element that describes it. */
  readonly describedBy?: string | undefined;
  /** The options. */
  readonly options: readonly SearchOption[];
  /** The chosen value; none when nothing is. */
  readonly value: string | undefined;
  /** Whether the list offers "no value"; `true` by default. */
  readonly canClear?: boolean;
  /** Called with the chosen value; none for "no value". */
  readonly onChange: (value: string | undefined) => void;
};

/** The options a search keeps: every word in the name or in what it holds. */
const matching = (options: readonly SearchOption[], search: string): readonly SearchOption[] => {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  return options.filter((option) => {
    const text = `${option.label} ${option.hint ?? ""}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
};

/**
 * A list to search.
 *
 * @param props - the options and the chosen value.
 */
export const SearchSelect = ({
  label,
  describedBy,
  options,
  value,
  canClear = true,
  onChange
}: SearchSelectProps): ReactNode => {
  const listId = useId();
  const [search, setSearch] = useState<string | undefined>(undefined);
  const [active, setActive] = useState(0);
  const isOpen = search !== undefined;
  const found = useMemo(() => matching(options, search ?? ""), [options, search]);
  const shown = found.slice(0, MOST_SHOWN);
  const chosenLabel = options.find((option) => option.value === value)?.label ?? value ?? "";
  // the first row takes the value away, where it may go: a reader always has a way back
  const rows: readonly SearchOption[] = canClear
    ? [{ value: CLEAR_ROW, label: EDITOR_STRINGS.searchClear }, ...shown]
    : shown;
  const close = (): void => {
    setSearch(undefined);
    setActive(0);
  };
  const choose = (row: SearchOption | undefined): void => {
    if (row !== undefined) onChange(row.value === CLEAR_ROW ? undefined : row.value);
    close();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const count = Math.max(1, rows.length);
      if (!isOpen) setSearch("");
      else setActive((current) => (current + (event.key === "ArrowDown" ? 1 : count - 1)) % count);
    } else if (event.key === "Escape" && isOpen) {
      event.stopPropagation();
      close();
    } else if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      choose(rows[active]);
    }
  };
  const optionId = (index: number): string => `${listId}-${index}`;
  return (
    <div className="forgebook-value-search">
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-describedby={describedBy}
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={isOpen && rows[active] !== undefined ? optionId(active) : undefined}
        autoComplete="off"
        value={search ?? chosenLabel}
        placeholder={EDITOR_STRINGS.searchClear}
        onFocus={(): void => setSearch("")}
        onBlur={close}
        onKeyDown={onKeyDown}
        onChange={(event: ChangeEvent<HTMLInputElement>): void => {
          setSearch(event.target.value);
          // what is typed names an option, so the first that matches is what Enter takes
          setActive(event.target.value !== "" && canClear ? 1 : 0);
        }}
      />
      {isOpen ? (
        <div
          className="forgebook-value-search__list"
          id={listId}
          role="listbox"
          aria-label={EDITOR_STRINGS.searchOptions(label)}
        >
          {rows.map((option, index) => (
            <div
              // two tokens may hold one value: the name tells the rows apart
              key={option.label}
              id={optionId(index)}
              role="option"
              tabIndex={-1}
              className="forgebook-value-search__option"
              aria-selected={option.value === CLEAR_ROW ? value === undefined : option.value === value}
              data-active={active === index || undefined}
              // chosen on the press: the field's blur that follows would close the list before a click
              onMouseDown={(event: MouseEvent<HTMLDivElement>): void => {
                event.preventDefault();
                choose(option);
              }}
            >
              {option.swatch === undefined ? null : (
                <span className="forgebook-value-search__swatch" style={{ background: option.swatch }} />
              )}
              <span className="forgebook-value-search__name">{option.label}</span>
              {option.hint === undefined ? null : (
                <span className="forgebook-value-search__hint">{option.hint}</span>
              )}
            </div>
          ))}
          {found.length === 0 ? <p className="forgebook-value-note">{EDITOR_STRINGS.searchEmpty}</p> : null}
          {found.length > MOST_SHOWN ? (
            <p className="forgebook-value-note">{EDITOR_STRINGS.searchMore(found.length - MOST_SHOWN)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
