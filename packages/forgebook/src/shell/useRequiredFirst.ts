/**
 * The reader's "Required first" switch, kept in this browser for the whole catalogue, and the layout of the required
 * props it leaves for a component or a story (`requiredFirstLayout`).
 *
 * @remarks
 * Stored as `useStored` stores a reader's preference (under the catalogue's id), but shared live by every table that
 * shows it: a docs page may hold several API references, and turning the switch in one turns it in all. Storage may
 * be refused (a private window): the switch then holds for the page only, and nothing fails.
 *
 * @module
 */
import type { RequiredFirst } from "@forgebook/story-format/csf";
import { useSyncExternalStore } from "react";

import { requiredFirstLayout } from "../propGroups.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { readStored, writeStored } from "./useStored.ts";

/**
 * The reader's switch from the text it is stored as: none for anything else, a text another script wrote included.
 *
 * @param stored - the stored text; none when nothing is stored.
 */
const readerSwitch = (stored: string | null): boolean | undefined => {
  if (stored === "on") return true;
  return stored === "off" ? false : undefined;
};

/** The tables showing the switch, told when it turns. */
const listeners = new Set<() => void>();

/**
 * The switch as turned in this page, by key: it wins over storage, which a browser may refuse to write (a private
 * window, a full quota) while still reading an older value.
 */
const turnedInPage = new Map<string, string>();

/**
 * Listens to the switch: turned in this page, or in another of the catalogue's tabs.
 *
 * @param listener - called when it may have turned.
 * @returns what stops listening.
 */
const subscribe = (listener: () => void): (() => void) => {
  // another tab's choice is the newer one: this page's own gives way to it
  const onStorage = (event: StorageEvent): void => {
    if (event.key === null) turnedInPage.clear();
    else turnedInPage.delete(event.key);
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return (): void => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

/** No stored switch where there is no page to store it in. */
const NOT_STORED = (): null => null;

/** Where the required props go, and the reader's switch over it. */
export type RequiredFirstState = {
  /** The layout to draw. */
  readonly layout: RequiredFirst;
  /** Whether the switch shows on: the layout puts the required props first. */
  readonly isOn: boolean;
  /** Turns the switch, for every component, and keeps it in this browser. */
  readonly setIsOn: (isOn: boolean) => void;
};

/**
 * Where a component's or a story's required props go for this reader.
 *
 * @param own - the story's or the component's own setting (`parameters.requiredFirst`); none for the catalogue's.
 */
export const useRequiredFirst = (own: RequiredFirst | undefined): RequiredFirstState => {
  const catalogue = useCatalogue();
  const key = `${catalogue.id}:required-first`;
  const stored = useSyncExternalStore(subscribe, () => turnedInPage.get(key) ?? readStored(key), NOT_STORED);
  const layout = requiredFirstLayout(own, catalogue.requiredFirst, readerSwitch(stored));
  return {
    layout,
    isOn: layout !== false,
    setIsOn: (isOn: boolean): void => {
      const text = isOn ? "on" : "off";
      turnedInPage.set(key, text);
      writeStored(key, text);
      for (const listener of listeners) listener();
    }
  };
};
