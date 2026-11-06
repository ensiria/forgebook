/**
 * An embed's values, checked as a link's are before the frame receives any: whoever embeds a story writes its address, and
 * the frame on the catalogue's origin takes what it is sent.
 *
 * @remarks
 * A module of its own, loaded only by an embed that has values: an embed without them pays for neither the check nor the
 * component's docs. Docs that cannot be read leave what the story itself declares.
 *
 * @module
 */
import {
  type ArgDeclaration,
  type CheckedArgs,
  checkedAddressArgs,
  declaredArgProps
} from "../addressArgs.ts";
import type { AddressLink } from "../addressArgsParam.ts";
import { isComponentDocs } from "../componentDocs.ts";
import type { PanelArgs } from "../messages.ts";
import type { NamedValues } from "../namedValues.ts";
import { isFileList, isValueOfShape } from "../shapeValues.ts";
import { type ArgControlLoaders, customChecksOf } from "./customControls.ts";
import type { ReadyMessage } from "./useFrameMessages.ts";

/** What the check on an embed's values reads of the story's source. */
export type EmbedSource = {
  /** Loads the component's docs; none when the source has none for the file. */
  readonly loadDocs: (() => Promise<unknown>) | undefined;
  /** The source's named values. */
  readonly namedValues: NamedValues;
  /** The catalogue's custom controls. */
  readonly argControls: ArgControlLoaders;
};

/**
 * An embed's values, checked.
 *
 * @param panelArgs - the values the address sets.
 * @param ready - what the story's frame reported.
 * @param typeValue - types the values, for a link whose form does not say.
 * @param source - what the check reads of the story's source.
 */
export const checkedEmbedArgs = async (
  panelArgs: PanelArgs,
  ready: ReadyMessage,
  typeValue: AddressLink["typeValue"],
  source: EmbedSource
): Promise<CheckedArgs> => {
  const docs: unknown = await source.loadDocs?.().catch(() => undefined);
  const declaration: ArgDeclaration = {
    props: isComponentDocs(docs) ? docs.props : [],
    argTypes: ready.argTypes,
    controls: ready.controls,
    storyArgs: ready.args,
    namedValues: source.namedValues
  };
  const names = declaredArgProps(declaration).flatMap((prop) => prop.customControl ?? []);
  const custom = names.length === 0 ? {} : await customChecksOf(names, source.argControls);
  return checkedAddressArgs(panelArgs, declaration, typeValue, { isFileList, isValueOfShape }, custom);
};
