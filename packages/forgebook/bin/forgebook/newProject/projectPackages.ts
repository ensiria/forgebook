/**
 * What the written configuration needs installed, and what a project has of it: the packages to add, and the ones it
 * has declared too old for Forgebook to draw with.
 *
 * @remarks
 * A package's folder is looked for in the `node_modules` folders going up rather than resolved: many packages' `exports`
 * leave out `package.json`, which would read as not installed, and `NODE_PATH`, which a package manager's shims set, is
 * something Vite does not read. A declared version is the project's decision, so one too old is
 * a stop, while a version found only in `node_modules` came with something else and is simply not the project's yet.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { isRecord, projectManifest } from "../importers/storybook.ts";
import type { ImportedFramework } from "../importers/storybookFrameworks.ts";
import { FORGEBOOK_PEERS, PROJECT_FRAMEWORKS } from "./projectFrameworks.ts";

/** The longest range read, so a planted one costs nothing. */
const MAX_RANGE_LENGTH = 256;

/** A package below the lowest version Forgebook takes. */
export type TooOldPackage = {
  /** Its name. */
  readonly name: string;
  /** The version found, as written. */
  readonly found: string;
  /** The lowest version taken. */
  readonly floor: string;
};

/** What a project has of the packages the configuration needs. */
export type PackageState = {
  /** What it neither declares nor can load. */
  readonly missing: readonly string[];
  /** What it declares too old. */
  readonly tooOld: readonly TooOldPackage[];
  /** Whether something it declares is not installed yet. */
  readonly hasUninstalled: boolean;
};

/** A version's numbers. */
const numbersOf = (parts: readonly (string | undefined)[]): readonly number[] =>
  parts.map((part) => Number(part ?? 0) || 0);

/** Whether one version's numbers come before another's. */
const isBelow = (version: readonly number[], floor: readonly number[]): boolean => {
  for (const [index, number] of version.entries()) {
    const other = floor[index] ?? 0;
    if (number !== other) return number < other;
  }
  return false;
};

/** A version as text: one that names no number reads as zero. */
const parsedVersion = (text: string): readonly number[] => {
  const match = text.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return numbersOf([match?.[1], match?.[2], match?.[3]]);
};

/** The first version a plain range does not take; none when it has no such end. */
const rangeEnd = (
  operator: string,
  major: number,
  minor: string | undefined,
  patch: string | undefined
): readonly number[] => {
  const isWild = (part: string | undefined): boolean => part === undefined || part === "x" || part === "*";
  const minorNumber = Number(minor) || 0;
  if (operator === "^") return major > 0 ? [major + 1, 0, 0] : [0, minorNumber + 1, 0];
  if (isWild(minor)) return [major + 1, 0, 0];
  return operator === "~" || isWild(patch)
    ? [major, minorNumber + 1, 0]
    : [major, minorNumber, (Number(patch) || 0) + 1];
};

/**
 * Whether one alternative of a range can give a version at or above a floor. What names no version (`workspace:*`,
 * `latest`) can, since only the package manager can read it.
 */
const canReach = (alternative: string, floor: readonly number[]): boolean => {
  const text = alternative.trim();
  const upper = text.match(/<(=?)\s*(\d[\d.]*)/);
  if (upper !== null) {
    const end = parsedVersion(upper[2] ?? "");
    return upper[1] === "=" ? !isBelow(end, floor) : isBelow(floor, end);
  }
  if (text.startsWith(">")) return true;
  const match = text.match(/^([\^~]|=|v)?(\d+)(?:\.(\d+|x|\*))?(?:\.(\d+|x|\*))?/);
  if (match === null) return true;
  const end = rangeEnd(match[1] ?? "", Number(match[2]), match[3], match[4]);
  return isBelow(floor, end);
};

/**
 * Whether what a project wrote or has installed cannot reach a floor: `^8.0.1` can reach `8.3.4`, `^18.3.0` cannot reach
 * `19.0.0`, and a range counts by its best alternative, since a library's `^18 || ^19` takes the floor's major too.
 *
 * @param version - the version or the range.
 * @param floor - the lowest version taken.
 */
export const isBelowFloor = (version: string, floor: string): boolean => {
  const floorNumbers = parsedVersion(floor);
  return !version
    .slice(0, MAX_RANGE_LENGTH)
    .split("||")
    .some((alternative) => canReach(alternative, floorNumbers));
};

/**
 * The packages a project declares, with their versions as written: a design system's framework is a peer.
 *
 * @param projectDir - the project's folder.
 */
export const declaredPackages = (projectDir: string): ReadonlyMap<string, string> => {
  const manifest = projectManifest(projectDir);
  return new Map(
    ["peerDependencies", "devDependencies", "dependencies"].flatMap((field) => {
      const list = manifest[field];
      return isRecord(list)
        ? Object.entries(list).flatMap(([name, version]) =>
            typeof version === "string" ? [[name, version] as const] : []
          )
        : [];
    })
  );
};

/**
 * How the install command names a package: Angular's own at the project's major, since the latest of one beside the
 * rest at an older major does not install.
 *
 * @param name - the package.
 * @param declared - the packages the project declares.
 */
export const installSpecifier = (name: string, declared: ReadonlyMap<string, string>): string => {
  const major = declared.get("@angular/core")?.match(/\d+/)?.[0];
  return name.startsWith("@angular/") && major !== undefined ? `${name}@^${major}.0.0` : name;
};

/** The nearest `node_modules` copy of a package, going up from a folder. */
const nearestManifest = (dir: string, name: string): string | undefined => {
  const manifest = join(dir, "node_modules", name, "package.json");
  if (existsSync(manifest)) return manifest;
  const parent = dirname(dir);
  return parent === dir ? undefined : nearestManifest(parent, name);
};

/**
 * The version of a package a folder can load, read from its `package.json`.
 *
 * @param dir - the folder.
 * @param name - the package.
 * @returns its version, `""` for one that names none, or none when it is not installed.
 */
export const installedVersion = (dir: string, name: string): string | undefined => {
  const manifest = nearestManifest(dir, name);
  if (manifest === undefined) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(manifest, "utf8"));
  const version =
    typeof parsed === "object" && parsed !== null && "version" in parsed ? parsed.version : undefined;
  return typeof version === "string" ? version : "";
};

/**
 * The packages a configuration needs with the lowest version of each: `forgebook`, the adapter, what either asks the
 * project for, and what the adapter's options add (no floor, written as `0.0.0`).
 *
 * @param framework - the framework.
 * @param extraPeers - what its options add.
 */
export const requiredPackages = (
  framework: ImportedFramework,
  extraPeers: readonly string[]
): ReadonlyMap<string, string> => {
  const required = new Map<string, string>([
    ["forgebook", "0.0.0"],
    [`@forgebook/${framework}`, "0.0.0"]
  ]);
  for (const peers of [FORGEBOOK_PEERS, PROJECT_FRAMEWORKS[framework].peers]) {
    for (const [name, floor] of Object.entries(peers)) {
      const known = required.get(name);
      if (known === undefined || isBelowFloor(known, floor)) required.set(name, floor);
    }
  }
  for (const name of extraPeers) if (!required.has(name)) required.set(name, "0.0.0");
  return required;
};

/**
 * What a project has of the packages a configuration needs.
 *
 * @param dir - the project's folder.
 * @param declared - the packages it declares, with their versions as written.
 * @param required - the packages needed, with the lowest version of each.
 */
export const packageState = (
  dir: string,
  declared: ReadonlyMap<string, string>,
  required: ReadonlyMap<string, string>
): PackageState => {
  const missing: string[] = [];
  const tooOld: TooOldPackage[] = [];
  let hasUninstalled = false;
  for (const [name, floor] of required) {
    const written = declared.get(name);
    const installed = installedVersion(dir, name);
    const found = installed === undefined || installed === "" ? written : installed;
    // an alias (`npm:@preact/compat`) has a version of its own package's, which says nothing of this one's
    const isOld = found !== undefined && written?.startsWith("npm:") !== true && isBelowFloor(found, floor);
    if (written !== undefined && isOld) tooOld.push({ name, found: found ?? written, floor });
    else if (written === undefined && (installed === undefined || isOld)) missing.push(name);
    else if (installed === undefined) hasUninstalled = true;
  }
  return { missing, tooOld, hasUninstalled };
};
