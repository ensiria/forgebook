/**
 * The kit's icon picker, as a library ships a control with its preset: every icon of the kit drawn with its name, and
 * "None", as radio buttons, so the arrow keys move between them and each has its name. Its value is the icon's name; the
 * frame module (`iconValue.ts`) turns it into the icon, and the story's code writes the icon (`toCode`).
 *
 * @module
 */
import type { ArgControlModule, ArgControlProps, ValueSchema } from "forgebook/arg-control";
import { type ReactNode, useId, useState } from "react";
import { createRoot } from "react-dom/client";

import { ICONS } from "../src/icons";

/** What its value looks like: the name of one of the kit's icons. */
export const schema: ValueSchema = { type: "string", enum: Object.keys(ICONS) };

/**
 * The code an icon's name is written as: the icon itself, as the kit exports it (`icon={IconStar}`).
 *
 * @param value - the panel's value: an icon's name.
 */
export const toCode: NonNullable<ArgControlModule["toCode"]> = (value) =>
  typeof value === "string" && Object.hasOwn(ICONS, value) ? value : undefined;

/** One choice: its picture, if any, and its name. */
const Choice = ({
  group,
  name,
  label,
  isChosen,
  onChoose,
  children
}: {
  readonly group: string;
  readonly name: string;
  readonly label: string;
  readonly isChosen: boolean;
  readonly onChoose: () => void;
  readonly children?: ReactNode;
}): ReactNode => (
  <label
    style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 6px", whiteSpace: "nowrap" }}
  >
    <input type="radio" name={group} value={name} checked={isChosen} onChange={onChoose} />
    {children}
    <span>{label}</span>
  </label>
);

/** The picker. */
const IconPicker = ({ value, onChange, argType, strings }: ArgControlProps): ReactNode => {
  const group = useId();
  const [chosen, setChosen] = useState(typeof value === "string" ? value : undefined);
  const choose = (name: string | undefined): void => {
    setChosen(name);
    onChange(name);
  };
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: 2 }}>
      <legend style={{ position: "absolute", clipPath: "inset(50%)" }}>
        {strings?.["label"] ?? `${argType.label}: icon`}
      </legend>
      <Choice
        group={group}
        name=""
        label={strings?.["none"] ?? "None"}
        isChosen={chosen === undefined}
        onChoose={(): void => choose(undefined)}
      />
      {Object.entries(ICONS).map(([name, Icon]) => (
        <Choice
          key={name}
          group={group}
          name={name}
          label={name}
          isChosen={chosen === name}
          onChoose={(): void => choose(name)}
        >
          <span aria-hidden="true" style={{ display: "inline-flex" }}>
            <Icon size={14} />
          </span>
        </Choice>
      ))}
    </fieldset>
  );
};

/**
 * Draws the picker.
 *
 * @param element - where it is drawn.
 * @param props - the value, how to change it, what the story says, its texts.
 * @returns what takes it away.
 */
export const mount = (element: HTMLElement, props: ArgControlProps): (() => void) => {
  const root = createRoot(element);
  root.render(<IconPicker {...props} />);
  return (): void => root.unmount();
};
