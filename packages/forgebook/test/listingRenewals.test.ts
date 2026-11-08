/**
 * Tests for which story files added or removed renew a group's list and reload the pages: by every version of the
 * group's module served since the pages last reloaded, since another reader (a second tab, a frame, the agents' API)
 * may load the module again before the file's event arrives.
 *
 * @module
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  FILES_PREFIX,
  keptListing,
  listingRenewals,
  pagesReloaded,
  type ServedListings
} from "../src/vite/pluginModules.ts";
import { storyFilesGroupText } from "../src/vite/storyFilesModule.ts";
import { VITE_PATHS } from "../src/vite/vitePaths.ts";

let root = "";
let id = "";

/** A file of the catalogue, absolute in Vite's form. */
const fileOf = (name: string): string => VITE_PATHS.normalize(join(root, "src", name));

/** A version of the group's module served, listing these files. */
const serve = (listings: Map<string, ServedListings | undefined>, names: readonly string[]): void => {
  keptListing(listings, id, () => ({ files: names.map((name) => ({ file: fileOf(name) })), refused: [] }));
};

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "forgebook-listing-"));
  mkdirSync(join(root, "src"));
  id = `${FILES_PREFIX}${storyFilesGroupText(root, ["./src/*.stories.ts"])}`;
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("listingRenewals", () => {
  it("reloads for a file removed that a page holds, though another reader loaded the list without it first", () => {
    const listings = new Map<string, ServedListings | undefined>();
    serve(listings, ["Button.stories.ts", "Card.stories.ts"]);
    // the agents' API reads the list after the switch removed the card, before the card's event arrives
    serve(listings, ["Button.stories.ts"]);
    expect(listingRenewals(listings, fileOf("Card.stories.ts"), ["reader"])).toEqual([id, "reader"]);
  });

  it("reloads for a file added that a page's version lacks, though another reader loaded it with the file", () => {
    writeFileSync(join(root, "src", "Field.stories.ts"), "export default {};\n");
    const listings = new Map<string, ServedListings | undefined>();
    serve(listings, []);
    serve(listings, ["Field.stories.ts"]);
    expect(listingRenewals(listings, fileOf("Field.stories.ts"), [])).toEqual([id]);
  });

  it("does not reload again for what every version since the last reload already shows", () => {
    writeFileSync(join(root, "src", "Late.stories.ts"), "export default {};\n");
    const listings = new Map<string, ServedListings | undefined>();
    serve(listings, ["Gone.stories.ts"]);
    pagesReloaded(listings);
    // the pages loaded the list again after the reload, with the switch's files in place
    serve(listings, ["Late.stories.ts"]);
    expect(listingRenewals(listings, fileOf("Late.stories.ts"), [])).toBeUndefined();
    expect(listingRenewals(listings, fileOf("Gone.stories.ts"), [])).toBeUndefined();
  });

  it("does not reload for a file added when no page loaded the list since the last reload", () => {
    const listings = new Map<string, ServedListings | undefined>();
    serve(listings, []);
    pagesReloaded(listings);
    expect(listingRenewals(listings, fileOf("Late.stories.ts"), [])).toBeUndefined();
  });

  it("leaves the list alone for a file no pattern lists and no version listed", () => {
    writeFileSync(join(root, "src", "notes.md"), "notes\n");
    const listings = new Map<string, ServedListings | undefined>();
    serve(listings, []);
    expect(listingRenewals(listings, fileOf("notes.md"), ["reader"])).toBeUndefined();
  });

  it("renews a list whose module could not be made", () => {
    expect(listingRenewals(new Map([[id, undefined]]), fileOf("notes.md"), [])).toEqual([id]);
  });
});
