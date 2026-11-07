/**
 * The list of the shell's keys: `?` opens it anywhere the shell's keys work, or the menu at the sidebar's foot.
 *
 * @remarks
 * Only the key and whether it is open sit in the first load; the list comes with its first opening.
 *
 * @module
 */
import { type ReactNode, useEffect, useState } from "react";

import { isSingleKeyFree } from "./keyboard.ts";
import { type LazyModule, LazyView, lazyModule } from "./lazyModule.tsx";
import type { ShortcutHelpProps } from "./ShortcutHelp.tsx";

/** The list, loaded when first opened. */
const SHORTCUT_HELP: LazyModule<ShortcutHelpProps> = lazyModule(() =>
  import("./ShortcutHelp.tsx").then((module) => module.ShortcutHelp)
);

/** What the shell wires to the list. */
export type ShortcutHelp = {
  /** The list, while it is open. */
  readonly help: ReactNode;
  /** Opens it. */
  readonly showHelp: () => void;
};

/** Listens to the key that opens the list, and holds whether it is open. */
export const useShortcutHelp = (): ShortcutHelp => {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    const open = (event: KeyboardEvent): void => {
      if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey || !isSingleKeyFree(event))
        return;
      event.preventDefault();
      setIsOpen(true);
    };
    document.addEventListener("keydown", open);
    return (): void => document.removeEventListener("keydown", open);
  }, []);
  return {
    help: isOpen ? (
      <LazyView
        module={SHORTCUT_HELP}
        props={{ onClose: (): void => setIsOpen(false) }}
        loading={null}
        failed={(): ReactNode => null}
      />
    ) : null,
    showHelp: (): void => setIsOpen(true)
  };
};
