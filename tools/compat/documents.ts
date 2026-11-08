/**
 * Reading the JSON the matrix depends on: a `package.json`, the npm registry's answer, and a cell's result or the whole
 * report. Every value is checked before use, so a changed registry answer or a hand-edited report fails with the file
 * and the field instead of drawing a wrong table.
 *
 * @module
 */
import type {
  CellCommand,
  CellResult,
  CellStatus,
  CompatReport,
  Manifest,
  PlannedCell,
  RegistryPackage
} from "./compat.types.ts";
import { parseVersion } from "./versions.ts";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A field holding strings by name, or an empty one when it is absent. */
const stringMap = (value: unknown, where: string): Record<string, string> => {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error(`${where} is not an object`);
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (typeof entry !== "string") throw new Error(`${where}.${key} is not a string`);
      return [key, entry];
    })
  );
};

/** A required string field. */
const text = (record: Record<string, unknown>, key: string, where: string): string => {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`${where}.${key} is not a string`);
  return value;
};

/** An optional string field. */
const optionalText = (record: Record<string, unknown>, key: string, where: string): string | undefined =>
  record[key] === undefined ? undefined : text(record, key, where);

/** The fields of a `package.json` the matrix reads. */
export const parseManifest = (source: string, file: string): Manifest => {
  const value: unknown = JSON.parse(source);
  if (!isRecord(value)) throw new Error(`${file} is not an object`);
  return {
    name: text(value, "name", file),
    scripts: stringMap(value["scripts"], `${file} scripts`),
    peerDependencies: stringMap(value["peerDependencies"], `${file} peerDependencies`),
    dependencies: stringMap(value["dependencies"], `${file} dependencies`),
    devDependencies: stringMap(value["devDependencies"], `${file} devDependencies`)
  };
};

/** The versions and dist-tags of the registry's abbreviated document for a package. */
export const parseRegistry = (value: unknown, name: string): RegistryPackage => {
  if (!isRecord(value) || !isRecord(value["versions"]))
    throw new Error(`the registry's answer for ${name} has no versions`);
  return {
    versions: Object.keys(value["versions"]),
    distTags: stringMap(value["dist-tags"], `${name} dist-tags`)
  };
};

/** The statuses a cell can end with. */
const STATUSES: readonly CellStatus[] = ["passed", "failed", "not-run"];

/** Whether a string is a cell status. */
const isStatus = (value: unknown): value is CellStatus => STATUSES.some((status) => status === value);

/** One command of a cell. */
const parseCommand = (value: unknown, where: string): CellCommand => {
  if (!isRecord(value)) throw new Error(`${where} is not an object`);
  const { code } = value;
  if (code !== null && typeof code !== "number")
    throw new Error(`${where}.code is neither a number nor null`);
  return { command: text(value, "command", where), code };
};

/** A version field: an exact version, never a range, a tag, a URL or `npm:`, since it goes into pnpm's overrides. */
const exactVersion = (value: string, where: string): string => {
  if (parseVersion(value) === undefined) throw new Error(`${where} is not an exact version: ${value}`);
  return value;
};

/** One planned cell, as `compat plan` lists it and the workflow hands it to `compat run`. */
export const parsePlannedCell = (value: unknown, where: string): PlannedCell => {
  if (!isRecord(value)) throw new Error(`${where} is not an object`);
  const tag = optionalText(value, "tag", where);
  const packages = stringMap(value["packages"], `${where}.packages`);
  for (const [name, version] of Object.entries(packages)) exactVersion(version, `${where}.packages.${name}`);
  return {
    id: text(value, "id", where),
    adapter: text(value, "adapter", where),
    host: text(value, "host", where),
    range: text(value, "range", where),
    line: text(value, "line", where),
    version: exactVersion(text(value, "version", where), `${where}.version`),
    packages,
    ...(tag === undefined ? {} : { tag })
  };
};

/** One cell's result, as `compat run` writes it. */
export const parseCell = (value: unknown, where: string): CellResult => {
  if (!isRecord(value)) throw new Error(`${where} is not an object`);
  const { status, commands } = value;
  if (!isStatus(status)) throw new Error(`${where}.status is not one of ${STATUSES.join(", ")}`);
  if (!Array.isArray(commands)) throw new Error(`${where}.commands is not a list`);
  const reason = optionalText(value, "reason", where);
  return {
    ...parsePlannedCell(value, where),
    status,
    ...(reason === undefined ? {} : { reason }),
    installed: stringMap(value["installed"], `${where}.installed`),
    commands: commands.map((command, index) => parseCommand(command, `${where}.commands[${index}]`)),
    node: text(value, "node", where)
  };
};

/** The report `docs/compatibility.json` holds. */
export const parseReport = (source: string, file: string): CompatReport => {
  const value: unknown = JSON.parse(source);
  if (!isRecord(value)) throw new Error(`${file} is not an object`);
  const { cells } = value;
  if (!Array.isArray(cells)) throw new Error(`${file}.cells is not a list`);
  const runUrl = optionalText(value, "runUrl", file);
  return {
    date: text(value, "date", file),
    ...(runUrl === undefined ? {} : { runUrl }),
    cells: cells.map((cell, index) => parseCell(cell, `${file}.cells[${index}]`))
  };
};
