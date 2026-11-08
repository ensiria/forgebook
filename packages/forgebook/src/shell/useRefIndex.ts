/**
 * A composed catalogue's index as a state the shell can show: loading, read, or why it failed.
 *
 * @module
 */
import { useEffect, useState } from "react";

import type { CatalogueRef, RefIndex } from "../catalogueRefs.ts";
import { loadRefIndex } from "./refIndexLoad.ts";

/** A composed catalogue's index: loading, read, or why it could not be. */
export type RefIndexState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly index: RefIndex }
  | { readonly status: "error"; readonly message: string };

/** What a load ended with, and for which catalogue's address. */
type Settled = { readonly url: string; readonly state: RefIndexState };

/** Before any load ended. */
const LOADING: RefIndexState = { status: "loading" };

/**
 * A composed catalogue's index, fetched once it is wanted (its section open, one of its stories shown).
 *
 * @remarks
 * What a load ended with is kept with the address it was for, so another catalogue's index never stands in for this
 * one's while its own loads: two catalogues built from one library share story ids.
 *
 * @param ref - the composed catalogue; none when there is none to read.
 * @param isWanted - whether it is wanted yet.
 */
export const useRefIndex = (ref: CatalogueRef | undefined, isWanted: boolean): RefIndexState => {
  const [settled, setSettled] = useState<Settled | undefined>(undefined);
  useEffect(() => {
    if (ref === undefined || !isWanted) return;
    let isCurrent = true;
    const settle = (state: RefIndexState): void => {
      if (isCurrent) setSettled({ url: ref.url, state });
    };
    loadRefIndex(ref).then(
      (index) => settle({ status: "ready", index }),
      (error: unknown) =>
        settle({ status: "error", message: error instanceof Error ? error.message : String(error) })
    );
    return () => {
      isCurrent = false;
    };
  }, [ref, isWanted]);
  return settled !== undefined && settled.url === ref?.url ? settled.state : LOADING;
};
