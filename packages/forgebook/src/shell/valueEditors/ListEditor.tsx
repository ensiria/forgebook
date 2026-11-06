/**
 * A list's items as fields, added, removed and moved with buttons, so a keyboard does all a pointer does: the focus
 * follows an item it moved, and a screen reader is told where it went.
 *
 * @remarks
 * Items keep their place as their key: an item has no identity of its own in JSON, and a key that moved with the value
 * would take the focus out of the field being typed in on every keystroke.
 *
 * @module
 */
import { type ReactNode, useEffect, useRef, useState } from "react";

import { type ArgValue, isArgList } from "../../messages.ts";
import { startValueOf } from "../../shapeValues.ts";
import type { ValueShape } from "../../valueShape.ts";
import { Icon } from "../icons.tsx";
import { EDITOR_STRINGS } from "./editorStrings.ts";
import type { DrawField, FieldProps } from "./fieldTypes.ts";

/** A button of an item, and where the focus goes after it. */
type ItemAction = "up" | "down" | "remove";

/** The focus to set once the list has drawn. */
type PendingFocus = { readonly index: number; readonly action: ItemAction | "add" };

/** The arrows, drawn as text: the first screen's icons stay what the first screen uses. */
const ARROWS = { up: "↑", down: "↓" } as const;

/** One small button of an item; at an end of the list it does nothing, but keeps the focus it was given. */
const ItemButton = ({
  action,
  label,
  isOff = false,
  onPress
}: {
  readonly action: ItemAction;
  readonly label: string;
  readonly isOff?: boolean;
  readonly onPress: () => void;
}): ReactNode => (
  <button
    type="button"
    className="forgebook-prop__action"
    data-action={action}
    aria-label={label}
    title={label}
    aria-disabled={isOff || undefined}
    onClick={isOff ? undefined : onPress}
  >
    {action === "remove" ? <Icon name="close" size={12} /> : ARROWS[action]}
  </button>
);

/**
 * A list's editor.
 *
 * @param props - the field's props, and how to draw an item.
 */
export const ListEditor = ({
  shape,
  value,
  label,
  namedValues,
  depth,
  onChange,
  drawField
}: FieldProps & {
  readonly shape: { readonly of: ValueShape };
  readonly drawField: DrawField;
}): ReactNode => {
  const items = value !== undefined && isArgList(value) ? value : [];
  const listRef = useRef<HTMLDivElement>(null);
  const pending = useRef<PendingFocus | undefined>(undefined);
  const [announcement, setAnnouncement] = useState("");
  const itemShape = shape.of;
  const start = startValueOf(itemShape, namedValues);
  useEffect(() => {
    const focus = pending.current;
    if (focus === undefined) return;
    pending.current = undefined;
    const selector =
      focus.action === "add"
        ? "[data-action='add']"
        : `[data-item='${focus.index}'] [data-action='${focus.action}']`;
    const fallback = listRef.current?.querySelector<HTMLElement>("[data-action='add']");
    (listRef.current?.querySelector<HTMLElement>(selector) ?? fallback)?.focus();
  });
  const itemLabel = (index: number): string => EDITOR_STRINGS.itemName(label, index + 1);
  const move = (index: number, by: -1 | 1, action: ItemAction): void => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    if (item === undefined) return;
    next.splice(index + by, 0, item);
    pending.current = { index: index + by, action };
    setAnnouncement(EDITOR_STRINGS.itemMoved(itemLabel(index), index + by + 1, next.length));
    onChange(next);
  };
  const remove = (index: number): void => {
    const next = items.filter((_, position) => position !== index);
    pending.current =
      next.length === 0
        ? { index: 0, action: "add" }
        : { index: Math.min(index, next.length - 1), action: "remove" };
    setAnnouncement(EDITOR_STRINGS.itemRemoved(itemLabel(index), next.length));
    onChange(next);
  };
  const change = (index: number, item: ArgValue | undefined): void => {
    if (item === undefined) return;
    onChange(items.map((each, position) => (position === index ? item : each)));
  };
  return (
    <div className="forgebook-value-list" ref={listRef}>
      {items.length === 0 ? <p className="forgebook-value-note">{EDITOR_STRINGS.emptyList}</p> : null}
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: an item is its place in the list, see the module's remarks
        <div key={index} className="forgebook-value-list__item" data-item={index}>
          <div className="forgebook-value-list__field">
            {drawField({
              shape: itemShape,
              value: item,
              label: itemLabel(index),
              namedValues,
              depth: depth + 1,
              isRequired: true,
              onChange: (next: ArgValue | undefined): void => change(index, next)
            })}
          </div>
          <div className="forgebook-value-list__buttons">
            <ItemButton
              action="up"
              label={EDITOR_STRINGS.moveUp(itemLabel(index))}
              isOff={index === 0}
              onPress={(): void => move(index, -1, "up")}
            />
            <ItemButton
              action="down"
              label={EDITOR_STRINGS.moveDown(itemLabel(index))}
              isOff={index === items.length - 1}
              onPress={(): void => move(index, 1, "down")}
            />
            <ItemButton
              action="remove"
              label={EDITOR_STRINGS.removeItem(itemLabel(index))}
              onPress={(): void => remove(index)}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        className="forgebook-text-button forgebook-value-add"
        data-action="add"
        disabled={start === undefined}
        onClick={(): void => {
          if (start === undefined) return;
          onChange([...items, start]);
        }}
      >
        <Icon name="plus" size={12} />
        {EDITOR_STRINGS.addItem(label)}
      </button>
      <span className="forgebook-visually-hidden" role="status">
        {announcement}
      </span>
    </div>
  );
};
