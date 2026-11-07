/**
 * A composed catalogue's index, fetched once per page when its section is first opened or one of its stories is shown.
 *
 * @remarks
 * Read with no credentials: the index is public, and a cookie of the other host has nothing to do with it. A failure is
 * kept too, so a section opened again says why without asking again; the page's next load tries once more.
 *
 * @module
 */
import { type CatalogueRef, type RefIndex, refIndexAddress, refIndexOf } from "../catalogueRefs.ts";
import { REF_STRINGS } from "./refStrings.ts";

/** Each composed catalogue's index, by its address, as fetched once. */
const loads = new Map<string, Promise<RefIndex>>();

/** Fetches and reads an index. */
const fetchIndex = async (address: string): Promise<RefIndex> => {
  const answer = await fetch(address, { credentials: "omit" });
  if (!answer.ok) throw new Error(`${answer.status} ${answer.statusText}`.trim());
  const index = refIndexOf(await answer.json());
  if (index === undefined) throw new Error(REF_STRINGS.notIndex);
  return index;
};

/**
 * A composed catalogue's index.
 *
 * @param ref - the composed catalogue.
 * @returns the index; rejected with the reason it could not be read.
 */
export const loadRefIndex = (ref: CatalogueRef): Promise<RefIndex> => {
  const address = refIndexAddress(ref);
  const known = loads.get(address);
  if (known !== undefined) return known;
  const load = fetchIndex(address);
  loads.set(address, load);
  return load;
};
