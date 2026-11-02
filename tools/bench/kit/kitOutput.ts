/**
 * What the kit leaves behind: the results file on the Desktop, shown before it is written and cleaned of the person's
 * identity, and the durations a machine can hand on as the next reference.
 *
 * @module
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, hostname, userInfo } from "node:os";
import { join } from "node:path";

import type { ScriptIo } from "@ensiria/cli-kit/io.types";
import { confirm } from "@ensiria/cli-kit/prompts";
import { ScriptError } from "@ensiria/cli-kit/script";

import { machineInfo, systemName } from "../machine.ts";
import { anonymize, type Identity, leaks, readme } from "./kitResults.ts";
import { type Asker, gigabytes, type KitPaths } from "./kitSession.ts";
import type { KitState } from "./kitState.ts";
import { zipArchive } from "./zipArchive.ts";

/** The kit's summary for the results file, and for whoever writes the next reference. */
export const kitSummary = async (state: KitState, io: ScriptIo): Promise<Record<string, unknown>> => ({
  commit: state.commit,
  profile: state.profile,
  startedAt: state.startedAt,
  finishedAt: new Date().toISOString(),
  machine: machineInfo(process.version, await systemName(io)),
  calibration: state.calibration,
  estimateMs: state.estimateMs,
  items: state.items
});

/** The identity the results are cleaned of. */
export const identity = (): Identity => ({ home: homedir(), user: userInfo().username, host: hostname() });

/** Writes the results file to the Desktop, after showing what goes in it. */
export const writeResults = async (
  state: KitState,
  paths: KitPaths,
  desktop: string,
  asker: Asker
): Promise<string | undefined> => {
  const who = identity();
  const files: { readonly name: string; readonly text: string }[] = [
    { name: "kit.json", text: `${JSON.stringify(await kitSummary(state, asker.io), null, 2)}\n` }
  ];
  const add = (folder: string, prefix: string): void => {
    if (!existsSync(folder)) return;
    for (const name of readdirSync(folder).sort()) {
      files.push({ name: `${prefix}/${name}`, text: readFileSync(join(folder, name), "utf8") });
    }
  };
  add(paths.reports, "reports");
  const calibration = join(paths.calibration, "report.json");
  if (existsSync(calibration))
    files.push({ name: "reports/calibration.json", text: readFileSync(calibration, "utf8") });
  add(paths.logs, "logs");
  const cleaned = files.map(({ name, text }) => ({ name, text: anonymize(text, who) }));
  const leaking = cleaned.flatMap(({ name, text }) => leaks(text, who).map((kind) => `${name} (${kind})`));
  if (leaking.length > 0) {
    throw new ScriptError("Non creo il file dei risultati: contiene ancora dati personali.", {
      hint: leaking.join(", ")
    });
  }
  const entries = [{ name: "LEGGIMI.txt", text: readme(cleaned.map(({ name }) => name)) }, ...cleaned].map(
    ({ name, text }) => ({ name, data: Buffer.from(text, "utf8") })
  );
  asker.log.step("Il file dei risultati conterrà:");
  for (const { name, data } of entries) asker.log.plain(`  ${name}  (${(data.length / 1024).toFixed(0)} KB)`);
  asker.log.plain(readme([]).split("\nFile:")[0] ?? "");
  const isWriting = await confirm(
    { message: "Creo il file dei risultati sul Desktop?", default: true },
    asker
  );
  if (!isWriting) return undefined;
  const folder = existsSync(desktop) ? desktop : paths.home;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  const file = join(folder, `forgebook-bench-${state.profile ?? "risultati"}-${stamp}.zip`);
  writeFileSync(file, zipArchive(entries, new Date()));
  asker.log.success(`Risultati salvati in ${file}`);
  return file;
};

/** Writes this machine's durations as a reference, for estimates on other machines. */
export const writeReference = async (state: KitState, file: string, io: ScriptIo): Promise<void> => {
  const info = machineInfo(process.version, await systemName(io));
  const items = Object.fromEntries(Object.entries(state.items).map(([id, item]) => [id, item?.timing]));
  const reference = {
    machine: `${info.cpu}, ${info.cpus} CPU, ${gigabytes(info.memory)}, ${info.os ?? info.platform}`,
    calibration: state.calibration,
    items
  };
  writeFileSync(file, `${JSON.stringify(reference, null, 2)}\n`);
};
