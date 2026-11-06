/**
 * Which catalogues each spec of the shell suite opens, and the suite cut into groups of catalogues
 * (`FORGEBOOK_SHELL_GROUP`), so a machine short of memory runs a few dev servers at a time instead of all of them.
 *
 * @remarks
 * Every catalogue is a Vite dev server of its own, about a gigabyte each once it has optimised its dependencies and read
 * its TypeScript: all of them at once are more than a 16 GB Windows runner holds, and there a memory short of its commit
 * limit turns into failed sockets (`net::ERR_NO_BUFFER_SPACE`) and seconds-long stalls. With
 * `FORGEBOOK_SHELL_GROUP=2/3` the suite starts only the second third of the catalogues (in `CATALOGUES` order) and runs
 * only the specs whose first catalogue is among them; the groups together run every spec once. Without it, every
 * catalogue starts and every spec runs.
 *
 * A spec opens the fixture app's catalogue unless `SPEC_CATALOGUES` names others; the specs are read to keep that table
 * true, so a spec that opens a catalogue the table does not give it fails the run before it starts.
 *
 * @module
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { CATALOGUES, type Catalogue } from "./ports";

/** The catalogues a spec opens, when not only the fixture app's: the first decides its group. */
const SPEC_CATALOGUES: Readonly<Record<string, readonly Catalogue[]>> = {
  "a11y.e2e.ts": ["app", "themes"],
  "angular.e2e.ts": ["angular"],
  "embed.e2e.ts": ["white-label", "app"],
  "gallery.e2e.ts": ["themes"],
  "home.e2e.ts": ["app", "generated-home"],
  "html.e2e.ts": ["html"],
  "nextjs.e2e.ts": ["nextjs"],
  "nuxt.e2e.ts": ["nuxt"],
  "parity.e2e.ts": ["parity"],
  "preact.e2e.ts": ["preact"],
  "reactNative.e2e.ts": ["react-native"],
  "restartedServer.e2e.ts": ["html"],
  "solid.e2e.ts": ["solid"],
  "svelte.e2e.ts": ["svelte"],
  "sveltekit.e2e.ts": ["sveltekit"],
  "vue.e2e.ts": ["vue"],
  "webComponents.e2e.ts": ["web-components"]
};

/** A catalogue named in a spec's code, through the helpers of `ports.ts`. */
const NAMED_CATALOGUE = /\b(?:catalogueUrl|portOf|framesPortOf)\("([a-z-]+)"\)/g;

/** A spec of the suite and the catalogues it opens. */
export type Spec = {
  /** Its file name, in the suite's folder. */
  readonly file: string;
  /** The catalogues its tests open; the first decides its group. */
  readonly catalogues: readonly Catalogue[];
};

/**
 * The suite's specs, each with the catalogues it opens.
 *
 * @param folder - the suite's folder.
 * @throws when a spec names a catalogue `SPEC_CATALOGUES` does not give it.
 */
export const specsIn = (folder: string): readonly Spec[] =>
  readdirSync(folder)
    .filter((file) => file.endsWith(".e2e.ts"))
    .map((file) => {
      const catalogues = SPEC_CATALOGUES[file] ?? ["app"];
      const code = readFileSync(join(folder, file), "utf8");
      for (const [, named] of code.matchAll(NAMED_CATALOGUE))
        if (!catalogues.some((catalogue) => catalogue === named))
          throw new Error(
            `${file} opens the ${named} catalogue: give it in SPEC_CATALOGUES (catalogueGroups.ts)`
          );
      return { file, catalogues };
    });

/** A part of the suite: the catalogues it starts and the specs it runs. */
export type Group = {
  /** Which group, from 1, and how many there are; none when the suite runs whole. */
  readonly place?: { readonly index: number; readonly count: number };
  /** The catalogues to start, in `CATALOGUES` order. */
  readonly catalogues: readonly Catalogue[];
  /** The specs to run, by file name. */
  readonly specs: readonly string[];
};

/**
 * Reads a group as `FORGEBOOK_SHELL_GROUP` writes it: `<index>/<count>`, the index from 1.
 *
 * @param text - the variable's value.
 * @throws when it is not a group of at most as many groups as catalogues.
 */
const placeOf = (text: string): { index: number; count: number } => {
  const match = /^(\d+)\/(\d+)$/.exec(text.trim());
  const index = Number(match?.[1]);
  const count = Number(match?.[2]);
  if (match === null || count < 1 || count > CATALOGUES.length || index < 1 || index > count)
    throw new Error(
      `FORGEBOOK_SHELL_GROUP=${text}: write <index>/<count>, from 1/1 to ${CATALOGUES.length}/${CATALOGUES.length}`
    );
  return { index, count };
};

/**
 * The part of the suite a run takes: every catalogue and spec, or the group `FORGEBOOK_SHELL_GROUP` names, the
 * catalogues cut in `count` runs of consecutive ones in `CATALOGUES` order.
 *
 * @param specs - the suite's specs (`specsIn`).
 * @param groupText - `FORGEBOOK_SHELL_GROUP`'s value, if set.
 */
export const groupOf = (specs: readonly Spec[], groupText: string | undefined): Group => {
  if (groupText === undefined || groupText === "")
    return { catalogues: CATALOGUES, specs: specs.map((spec) => spec.file) };
  const place = placeOf(groupText);
  // consecutive runs as even as the count allows, none of them empty
  const own = new Set<Catalogue>(
    CATALOGUES.filter((_, at) => Math.floor((at * place.count) / CATALOGUES.length) === place.index - 1)
  );
  const taken = specs.filter((spec) => spec.catalogues[0] !== undefined && own.has(spec.catalogues[0]));
  // a spec of the group may open a catalogue of another group too: it starts here as well
  const opened = new Set<Catalogue>([...own, ...taken.flatMap((spec) => spec.catalogues)]);
  return {
    place,
    catalogues: CATALOGUES.filter((catalogue) => opened.has(catalogue)),
    specs: taken.map((spec) => spec.file)
  };
};

/**
 * The part of the suite this run takes, from `FORGEBOOK_SHELL_GROUP`.
 *
 * @param folder - the suite's folder.
 */
export const runGroup = (folder: string): Group =>
  groupOf(specsIn(folder), process.env["FORGEBOOK_SHELL_GROUP"]);
