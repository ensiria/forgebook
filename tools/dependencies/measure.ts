/**
 * What one published package brings, read from what npm wrote: the lockfile of an empty project that installed it, and
 * `npm audit --json` on that lockfile. Also the report on disk, read back. Pure, and every field is checked before use,
 * so a changed npm answer or a hand-edited report fails with the field instead of drawing a wrong page.
 *
 * @module
 */
import type {
  Advisory,
  DependencyReport,
  MeasuredPackage,
  PackageResult,
  Severity
} from "./dependencies.types.ts";

/** The severities, the most serious first. */
export const SEVERITIES: readonly Severity[] = ["critical", "high", "moderate", "low", "info"];

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A field that must be an object. */
const recordAt = (value: unknown, where: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`${where} is not an object`);
  return value;
};

/** A field that must be a string. */
const textAt = (record: Record<string, unknown>, key: string, where: string): string => {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`${where}.${key} is not a string`);
  return value;
};

/** A field that must be a whole number of zero or more. */
const countAt = (record: Record<string, unknown>, key: string, where: string): number => {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
    throw new Error(`${where}.${key} is not a count`);
  return value;
};

/** Whether a text is a severity. */
const isSeverity = (value: unknown): value is Severity => SEVERITIES.some((severity) => severity === value);

/** A field that must be a severity. */
const severityAt = (record: Record<string, unknown>, key: string, where: string): Severity => {
  const value = record[key];
  if (!isSeverity(value)) throw new Error(`${where}.${key} is not a severity`);
  return value;
};

/** The order advisories are listed in: the most serious first, then by package and address. */
const byConcern = (first: Advisory, second: Advisory): number =>
  SEVERITIES.indexOf(first.severity) - SEVERITIES.indexOf(second.severity) ||
  first.package.localeCompare(second.package) ||
  first.url.localeCompare(second.url);

/**
 * The advisories of `npm audit --json`. An entry of `vulnerabilities` is a package; its `via` holds the advisories
 * about that package as objects, and the names of the packages it is vulnerable through as strings, which are entries
 * of their own. An advisory is through a peer when every place the package sits is a peer's in the lockfile.
 */
const advisoriesOf = (audit: unknown, peers: ReadonlySet<string>): Advisory[] => {
  const vulnerabilities = recordAt(
    recordAt(audit, "npm audit")["vulnerabilities"],
    "npm audit.vulnerabilities"
  );
  const found = new Map<string, Advisory>();
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    const where = `npm audit.vulnerabilities.${name}`;
    const vulnerability = recordAt(entry, where);
    const nodes = vulnerability["nodes"];
    const via = vulnerability["via"];
    if (!Array.isArray(nodes) || !Array.isArray(via)) throw new Error(`${where} has no nodes or via`);
    const isThroughPeer =
      nodes.length > 0 && nodes.every((node) => typeof node === "string" && peers.has(node));
    for (const cause of via) {
      if (!isRecord(cause)) continue;
      const url = textAt(cause, "url", `${where}.via`);
      found.set(url, {
        url,
        title: textAt(cause, "title", `${where}.via`),
        severity: severityAt(cause, "severity", `${where}.via`),
        package: textAt(cause, "name", `${where}.via`),
        range: textAt(cause, "range", `${where}.via`),
        isThroughPeer
      });
    }
  }
  return [...found.values()].toSorted(byConcern);
};

/**
 * One package measured from the lockfile of an empty project that installed it alone, and the audit of that lockfile.
 *
 * @param name - the package's name.
 * @param lock - `package-lock.json`, parsed.
 * @param audit - `npm audit --json`, parsed.
 * @throws when the lockfile does not hold the package, or either document is not in the form npm writes.
 */
export const measuredPackage = (name: string, lock: unknown, audit: unknown): MeasuredPackage => {
  const entries = recordAt(recordAt(lock, "package-lock.json")["packages"], "package-lock.json.packages");
  const own = recordAt(entries[`node_modules/${name}`], `package-lock.json: node_modules/${name}`);
  const others = Object.entries(entries)
    .filter(([path]) => path !== "" && path !== `node_modules/${name}`)
    .map(([path, entry]) => ({ path, entry: recordAt(entry, `package-lock.json: ${path}`) }));
  const brought = others.filter(({ entry }) => entry["peer"] !== true);
  const peers = new Set(others.filter(({ entry }) => entry["peer"] === true).map(({ path }) => path));
  return {
    name,
    status: "measured",
    version: textAt(own, "version", `package-lock.json: node_modules/${name}`),
    direct: Object.keys(isRecord(own["dependencies"]) ? own["dependencies"] : {}).length,
    installed: brought.length,
    platformOnly: brought.filter(({ entry }) => entry["optional"] === true).length,
    peers: peers.size,
    advisories: advisoriesOf(audit, peers)
  };
};

/** One advisory of the report. */
const parseAdvisory = (value: unknown, where: string): Advisory => {
  const record = recordAt(value, where);
  const isThroughPeer = record["isThroughPeer"];
  if (typeof isThroughPeer !== "boolean") throw new Error(`${where}.isThroughPeer is not a boolean`);
  return {
    url: textAt(record, "url", where),
    title: textAt(record, "title", where),
    severity: severityAt(record, "severity", where),
    package: textAt(record, "package", where),
    range: textAt(record, "range", where),
    isThroughPeer
  };
};

/** One package of the report. */
const parsePackage = (value: unknown, where: string): PackageResult => {
  const record = recordAt(value, where);
  const name = textAt(record, "name", where);
  if (record["status"] === "unpublished") return { name, status: "unpublished" };
  if (record["status"] !== "measured") throw new Error(`${where}.status is neither measured nor unpublished`);
  const advisories = record["advisories"];
  if (!Array.isArray(advisories)) throw new Error(`${where}.advisories is not a list`);
  return {
    name,
    status: "measured",
    version: textAt(record, "version", where),
    direct: countAt(record, "direct", where),
    installed: countAt(record, "installed", where),
    platformOnly: countAt(record, "platformOnly", where),
    peers: countAt(record, "peers", where),
    advisories: advisories.map((advisory, index) => parseAdvisory(advisory, `${where}.advisories[${index}]`))
  };
};

/**
 * The report on disk.
 *
 * @param source - `docs/dependencies.json`'s text.
 * @param file - its name, for the errors.
 * @throws when a field is missing or of another type.
 */
export const parseReport = (source: string, file: string): DependencyReport => {
  const record = recordAt(JSON.parse(source), file);
  const packages = record["packages"];
  if (!Array.isArray(packages)) throw new Error(`${file}.packages is not a list`);
  const runUrl = record["runUrl"];
  if (runUrl !== undefined && typeof runUrl !== "string") throw new Error(`${file}.runUrl is not a string`);
  return {
    date: textAt(record, "date", file),
    npm: textAt(record, "npm", file),
    ...(runUrl === undefined ? {} : { runUrl }),
    packages: packages.map((entry, index) => parsePackage(entry, `${file}.packages[${index}]`))
  };
};
