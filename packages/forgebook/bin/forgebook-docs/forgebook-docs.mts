#!/usr/bin/env node
/**
 * The `forgebook-docs` command, the former name of `forgebook docs`: writes a package's `CATALOG.md` and `llms.txt`, or
 * checks them, and says where the command moved. Kept for one release so a package's `catalog` script keeps working
 * after an update.
 *
 * @module
 */
import { resolve } from "node:path";

import { defineScript } from "@ensiria/cli-kit/script";

import { catalogueDocs } from "./catalogueDocs.ts";
import type { CatalogueDocsReport } from "./catalogueDocs.types.ts";

/** The command, as the hints print it. */
const COMMAND = "forgebook-docs";

await defineScript({
  name: "forgebook-docs",
  command: COMMAND,
  summary: "Write a package's CATALOG.md and llms.txt (moved to forgebook docs).",
  icon: "docs",
  json: true,
  description:
    "The former name of forgebook docs, kept for one release: reads the package's exports, their TSDoc and its stories, and writes CATALOG.md and llms.txt in its folder.",
  options: {
    package: {
      type: "string",
      required: true,
      valueName: "folder",
      description: "The package's folder (packages/design-system)."
    },
    framework: {
      type: "string",
      default: "react",
      valueName: "name",
      description:
        "The framework the stories are written for: its package, @forgebook/<name>, reads the components' props."
    },
    check: {
      type: "boolean",
      short: "c",
      description: "Change nothing; fail when a file is stale or a file cannot be read (CI)."
    }
  },
  examples: [{ command: `${COMMAND} --package .`, description: "Now: forgebook docs." }],
  run: async ({ options, log }): Promise<CatalogueDocsReport> => {
    log.warn(
      "forgebook-docs is now forgebook docs: change the package's script, this name goes in the next release"
    );
    return catalogueDocs(
      {
        packageDir: resolve(options.package),
        framework: options.framework,
        isCheck: options.check,
        fixCommand: "forgebook docs"
      },
      log
    );
  }
}).run();
