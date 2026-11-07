/**
 * How `forgebook init` says what it did: its document under `--json`, sentences for a person otherwise.
 *
 * @module
 */
import { formatJson } from "@ensiria/cli-kit/files";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import type { Logger } from "@ensiria/cli-kit/log.types";

import type { AppBuildPlan } from "./appBuild/appBuild.ts";
import { CONFIG_FILE } from "./initConfig.ts";
import type { InitDocument } from "./newProject/newProject.types.ts";
import { PROJECT_FRAMEWORKS } from "./newProject/projectFrameworks.ts";

/** Says what of the project's own code will run when the catalogue starts, since nothing else tells a person. */
const sayAppBuild = ({ viteConfig, tsconfigPaths, postcss, runsCode }: AppBuildPlan, log: Logger): void => {
  const read = [
    ...(viteConfig === undefined ? [] : [viteConfig]),
    ...(postcss === undefined ? [] : [postcss]),
    ...(tsconfigPaths ? ["tsconfig paths"] : [])
  ];
  if (read.length === 0) return;
  const running =
    runsCode.length === 0 ? "" : `; starting it runs ${runsCode.join(" and ")}, as the app's build does`;
  log.info(`The catalogue will read ${read.join(", ")}${running} (appBuild: false turns it off)`);
};

/** Prints the outcome: the document under `--json`, sentences for a person otherwise. */
export const printInit = (
  document: InitDocument,
  { io, log, isJson }: { readonly io: ScriptIo; readonly log: Logger; readonly isJson: boolean }
): void => {
  if (isJson) {
    io.stdout.write(formatJson(document));
    return;
  }
  const { detectedFrom, name } = document.packageManager;
  if (document.route === "new-project") {
    const from = detectedFrom === undefined ? "no lock file: assumed" : detectedFrom;
    log.success(`${PROJECT_FRAMEWORKS[document.framework].label} project, ${name} (${from})`);
  }
  const count = document.stories.length;
  log.success(`${CONFIG_FILE} written: ${count} story ${count === 1 ? "glob" : "globs"}`);
  for (const file of document.written.slice(1)) log.success(`${file} written`);
  sayAppBuild(document.appBuild, log);
  for (const step of document.nextSteps) log.warn(step.message);
  for (const { command, description } of document.commands) log.info(`${command}: ${description}`);
};
