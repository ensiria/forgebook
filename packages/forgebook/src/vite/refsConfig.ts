/**
 * The configuration's `refs`, checked and made ready for the shell, and what the shell's generated entry says of them:
 * the catalogues shown in the sidebar after this one's stories.
 *
 * @module
 */
import { type CatalogueRef, refFolder, refProblem } from "../catalogueRefs.ts";
import { codeLiteral } from "../codeLiteral.ts";
import type { RefOption } from "./config.ts";
import type { ResolvedConfig } from "./configFile.ts";

/** The composed catalogues, ready for the shell, in the configuration's order. */
export type ResolvedRefs = readonly CatalogueRef[];

/**
 * Why the configuration's `refs` cannot be used, or none.
 *
 * @param config - the configuration, as loaded.
 */
export const refsProblem = (config: object): string | undefined => {
  const refs: unknown = Reflect.get(config, "refs");
  if (refs === undefined) return undefined;
  if (typeof refs !== "object" || refs === null || Array.isArray(refs))
    return 'refs must be an object of catalogues by id (`refs: { "design-system": { title, url } }`)';
  return Object.entries(refs).flatMap(([id, ref]: [string, unknown]) => refProblem(id, ref) ?? [])[0];
};

/**
 * The composed catalogues, each address its folder, in the configuration's order.
 *
 * @param refs - the configuration's `refs`, checked by `refsProblem`.
 */
export const resolvedRefs = (
  refs: Readonly<Record<string, RefOption>> | undefined
): readonly CatalogueRef[] =>
  Object.entries(refs ?? {}).map(([id, ref]) => ({ id, title: ref.title.trim(), url: refFolder(ref.url) }));

/** The module that draws the composed catalogues, imported only by a catalogue that composes one. */
export const REFS_MODULE = "forgebook/shell/refs";

/**
 * The composed catalogues and the code that draws them, for the shell; nothing for a catalogue that composes none, so
 * its first load carries not even the way to that code.
 *
 * @param config - the configuration.
 */
export const refsLines = (config: Pick<ResolvedConfig, "refs">): string[] =>
  config.refs.length === 0
    ? []
    : [
        "    refs: {",
        `      catalogues: ${codeLiteral(config.refs)},`,
        `      load: () => import(${codeLiteral(REFS_MODULE)}).then((module) => module.RefPart)`,
        "    },"
      ];

/** The name the build gives whether the catalogue composes others (`shell/composition.ts`). */
const REFS_CONSTANT = "__FORGEBOOK_REFS__";

/**
 * What the plugin defines in the build for composition: whether the catalogue composes others, so a shell that composes
 * none has every part of composition removed.
 *
 * @param refs - the composed catalogues.
 */
export const refsDefine = (refs: ResolvedRefs): Readonly<Record<string, string>> => ({
  [REFS_CONSTANT]: JSON.stringify(refs.length > 0)
});
