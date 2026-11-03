/**
 * Writes a package's `CATALOG.md` and `llms.txt`, or checks that both are up to date: what `forgebook docs` and its
 * former name `forgebook-docs` run.
 *
 * @module
 */
import { join, relative } from "node:path";

import { readFileSafe, readJson, writeIfChanged } from "@ensiria/cli-kit/files";
import { plural } from "@ensiria/cli-kit/format";
import type { Logger } from "@ensiria/cli-kit/log.types";
import { ScriptError } from "@ensiria/cli-kit/script";

import { frameworkDocsModule } from "../frameworkDocs.ts";
import type { CatalogueDocsReport } from "./catalogueDocs.types.ts";
import { catalogueMarkdown } from "./catalogueMarkdown.ts";
import { catalogueOptionsOf } from "./catalogueOptions.ts";
import { collectDocs } from "./collectDocs.ts";
import { llmsText } from "./llmsText.ts";

/** The file an agent reads first, beside the catalogue. */
const LLMS_FILE = "llms.txt";

/** What `catalogueDocs` is asked. */
export type CatalogueDocsRequest = {
  /** The package's folder, absolute. */
  readonly packageDir: string;
  /** The framework the stories are written for (`react`). */
  readonly framework: string;
  /** Whether to change nothing and fail when a file is stale (CI). */
  readonly isCheck: boolean;
  /** The command that rewrites the files, for the hint of a stale one. */
  readonly fixCommand: string;
};

/**
 * Writes the package's `CATALOG.md` and `llms.txt`, or checks them.
 *
 * @param request - the package, its framework, whether to check, and the command that fixes them.
 * @param log - where to report.
 * @returns the report, for `--json`.
 * @throws a `ScriptError` in a check when a file is stale or something could not be read, or when the package's options
 *   are wrong.
 */
export const catalogueDocs = async (
  request: CatalogueDocsRequest,
  log: Logger
): Promise<CatalogueDocsReport> => {
  const { packageDir } = request;
  const { options, problems: optionProblems } = catalogueOptionsOf(
    readJson(join(packageDir, "package.json"))
  );
  if (optionProblems.length > 0)
    throw new ScriptError(optionProblems.join("; "), {
      hint: "Fix the forgebook.catalog key of package.json"
    });
  const file = join(packageDir, options.file);
  const llmsFile = join(packageDir, LLMS_FILE);
  const shown = (path: string): string => relative(process.cwd(), path);
  const { data, problems } = collectDocs(
    packageDir,
    (await frameworkDocsModule(packageDir, request.framework)).extractStoryComponent,
    options
  );
  for (const problem of problems) log.error(problem);
  const text = catalogueMarkdown(data, options.sections);
  const llms = llmsText({
    packageName: data.packageName,
    description: data.description,
    catalogueFile: options.file,
    pages: data.pages ?? [],
    hasTokens: options.sections.includes("tokens") && data.tokens.length > 0
  });
  const counts = {
    components: data.components.length,
    pages: data.pages?.length ?? 0,
    modules: data.modules.length,
    sassModules: data.sassModules.length,
    styleSheets: data.styleSheets.length,
    tokens: data.tokens.length
  };
  const report = { file: shown(file), llmsFile: shown(llmsFile), counts, problems };
  if (request.isCheck) {
    if (problems.length > 0)
      throw new ScriptError(`${plural(problems.length, "problem")} reading the package`);
    const written: readonly (readonly [string, string])[] = [
      [file, text],
      [llmsFile, llms]
    ];
    for (const [path, expected] of written) {
      if (readFileSafe(path) !== expected)
        throw new ScriptError(`${shown(path)} is stale`, { hint: `Run ${request.fixCommand}` });
    }
    log.success(`${shown(file)} and ${LLMS_FILE} are up to date`);
    return { status: "valid", ...report };
  }
  const isWritten = [writeIfChanged(file, text), writeIfChanged(llmsFile, llms)].some(Boolean);
  log.success(`${shown(file)} and ${LLMS_FILE} ${isWritten ? "written" : "already up to date"}`);
  return { status: isWritten ? "written" : "up-to-date", ...report };
};
