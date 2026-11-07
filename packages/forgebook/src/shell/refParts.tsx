/**
 * What the shell draws of the composed catalogues (`refs`): their sidebar sections and the page of one of their stories.
 * The generated page imports it (`forgebook/shell/refs`) only for a catalogue that composes one, so the others' first
 * load carries not even the way to it.
 *
 * @remarks
 * One module for both places, so a catalogue that composes others loads one chunk for them, and the shell keeps one
 * slot type: a part drawn with the place it is drawn in.
 *
 * @module
 */
import type { ComponentType, ReactNode } from "react";

import type { CatalogueRef } from "../catalogueRefs.ts";
import { RefStoryPage, type RefStoryPageProps } from "./RefStoryPage.tsx";
import { SidebarRefs, type SidebarRefsProps } from "./SidebarRefs.tsx";

/** A part of the composed catalogues, with the place it is drawn in. */
export type RefPartProps =
  | ({ readonly place: "sidebar" } & SidebarRefsProps)
  | ({ readonly place: "page" } & RefStoryPageProps);

/** The composed catalogues, as the generated page hands them to the shell. */
export type ShellRefs = {
  /** The catalogues, in the configuration's order. */
  readonly catalogues: readonly CatalogueRef[];
  /** Loads what draws them (`RefPart`). */
  readonly load: () => Promise<ComponentType<RefPartProps>>;
};

/**
 * A part of the composed catalogues: the sidebar's sections, or a story's page.
 *
 * @param props - the place, and that part's props.
 */
export const RefPart = (props: RefPartProps): ReactNode =>
  props.place === "sidebar" ? <SidebarRefs {...props} /> : <RefStoryPage {...props} />;
