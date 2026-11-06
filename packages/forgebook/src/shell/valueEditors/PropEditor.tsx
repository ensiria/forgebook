/**
 * The panel's editors that load on use, as one prop asks for them: nested fields from its shape, a search among its
 * options or the source's named values, the catalogue's tokens, files. A catalogue of plain props never loads this module
 * (`PropRows.tsx`).
 *
 * @module
 */
import type { ReactNode } from "react";

import type { PanelProp } from "../../argTypes.ts";
import { type ArgValue, UNSET_ARG } from "../../messages.ts";
import type { NamedValues } from "../../namedValues.ts";
import { resolvedShape } from "../../shapeValues.ts";
import { canSetShape } from "../../valueShape.ts";
import type { ArgControlLoaders } from "../customControls.ts";
import { LazyView, lazyModule } from "../lazyModule.tsx";
import type { OnValueChange } from "../PropFields.tsx";
import { EDITOR_STRINGS } from "./editorStrings.ts";
import { FileEditor } from "./FileEditor.tsx";
import type { FieldProps } from "./fieldTypes.ts";
import { SearchSelect } from "./SearchSelect.tsx";
import { TokenEditor } from "./TokenEditor.tsx";
import { ValueField } from "./ValueField.tsx";

import "./valueEditors.scss";

/** The editor's props. */
export type PropEditorProps = {
  /** The prop. */
  readonly prop: PanelProp;
  /** Its value. */
  readonly value: ArgValue | undefined;
  /** The element that describes it. */
  readonly descriptionId: string;
  /** The source's named values. */
  readonly namedValues: NamedValues;
  /** Loads the catalogue's design tokens; none when it has none. */
  readonly loadTokens: (() => Promise<unknown>) | undefined;
  /** Loads each custom control the catalogue registers, by name; none when it registers none. */
  readonly argControls: ArgControlLoaders | undefined;
  /** Called with a changed value. */
  readonly onValueChange: OnValueChange;
};

/** The host of the custom controls, which a catalogue with none never loads. */
const CUSTOM_CONTROL = lazyModule(() =>
  import("../CustomControl.tsx").then((module) => module.CustomControl)
);

/** No custom control registered. */
const NO_ARG_CONTROLS: ArgControlLoaders = {};

/** A custom control's field: its host loads with the first, so an editor of any other kind pays nothing for it. */
const CustomField = ({
  prop,
  name,
  value,
  argControls,
  onValueChange
}: Pick<PropEditorProps, "prop" | "value" | "argControls" | "onValueChange"> & {
  readonly name: string;
}): ReactNode => (
  <LazyView
    module={CUSTOM_CONTROL}
    props={{ prop, name, value, loaders: argControls ?? NO_ARG_CONTROLS, onValueChange }}
    loading={null}
    failed={(message: string): ReactNode => (
      <p className="forgebook-prop__description forgebook-prop__problem" role="alert">
        {message}
      </p>
    )}
  />
);

/** A prop's fields, or why it has none: a required part only named values can fill, and the source names none. */
const ShapedField = (props: FieldProps): ReactNode =>
  canSetShape(props.shape, props.namedValues) ? (
    <ValueField {...props} />
  ) : (
    <p className="forgebook-value-note">{EDITOR_STRINGS.cannotSet}</p>
  );

/**
 * One prop's editor.
 *
 * @param props - the prop, its value, and what it may draw from.
 */
export const PropEditor = ({
  prop,
  value,
  descriptionId,
  namedValues,
  loadTokens,
  argControls,
  onValueChange
}: PropEditorProps): ReactNode => {
  const label = prop.label ?? prop.name;
  const change = (next: ArgValue | undefined): void => onValueChange(prop.name, next ?? UNSET_ARG);
  if (prop.customControl !== undefined) {
    return (
      <CustomField
        prop={prop}
        name={prop.customControl}
        value={value}
        argControls={argControls}
        onValueChange={onValueChange}
      />
    );
  }
  if (prop.control === "file") {
    return (
      <FileEditor
        label={label}
        describedBy={descriptionId}
        accept={prop.accept}
        value={value}
        onChange={change}
      />
    );
  }
  if (prop.control === "token" && prop.tokens !== undefined) {
    return (
      <TokenEditor
        label={label}
        describedBy={descriptionId}
        tokens={prop.tokens}
        value={typeof value === "string" ? value : undefined}
        loadTokens={loadTokens}
        onChange={change}
      />
    );
  }
  if (Object.hasOwn(namedValues, prop.type) && prop.control === undefined && prop.kind === "other") {
    return (
      <ValueField
        shape={{
          kind: "named",
          type: prop.type,
          ...(prop.canTakeText === true ? { canTakeText: true } : {})
        }}
        value={value}
        label={label}
        describedBy={descriptionId}
        namedValues={namedValues}
        depth={0}
        onChange={change}
      />
    );
  }
  if (prop.shape !== undefined) {
    return (
      <ShapedField
        shape={resolvedShape(prop.shape)}
        value={value}
        label={label}
        describedBy={descriptionId}
        namedValues={namedValues}
        depth={0}
        onChange={change}
      />
    );
  }
  // many options, searched
  const choices = prop.choices ?? [];
  return (
    <SearchSelect
      label={label}
      describedBy={descriptionId}
      options={choices.map((choice) => ({
        value: String(choice),
        label: prop.labels?.[String(choice)] ?? String(choice)
      }))}
      value={typeof value === "string" || typeof value === "number" ? String(value) : undefined}
      onChange={(text: string | undefined): void => change(choices.find((choice) => String(choice) === text))}
    />
  );
};
