/**
 * The cells of one run: for every package and every tool it is tested against, the newest release of each line its
 * range claims, and the tool's prerelease when one is ahead. Pure: the manifests and the registry's answers come in.
 *
 * @module
 */
import type {
  AdapterDefinition,
  AdapterHost,
  CompatMatrix,
  HostDefinition,
  Manifest,
  PlannedCell,
  RangeSource,
  RegistryPackage
} from "./compat.types.ts";
import { caretClauses, compareVersions, isPrerelease, newestInClause, parseVersion } from "./versions.ts";

/**
 * The version of a tool's other package that goes with its first package's: the same one when it was published, else
 * its newest release of the same minor (a package that ships patches on its own), else the same one, which then fails
 * the install and reads "not run" rather than test a mix nobody chose.
 */
export const companionVersion = (version: string, published: RegistryPackage | undefined): string => {
  if (published === undefined || published.versions.includes(version)) return version;
  const parsed = parseVersion(version);
  if (parsed === undefined) return version;
  const sameMinor = published.versions
    .filter((candidate) => {
      const other = parseVersion(candidate);
      return (
        other !== undefined &&
        other.prerelease.length === 0 &&
        other.major === parsed.major &&
        other.minor === parsed.minor
      );
    })
    .sort(compareVersions);
  return sameMinor.at(-1) ?? version;
};

/** The exact version of each of a tool's packages for one version of the tool. */
const packageVersions = (
  host: HostDefinition,
  line: string,
  version: string,
  registry: ReadonlyMap<string, RegistryPackage>
): Record<string, string> => ({
  ...Object.fromEntries(host.packages.map((name) => [name, companionVersion(version, registry.get(name))])),
  ...Object.fromEntries(
    Object.entries(host.companions?.[line] ?? {}).map(([name, wanted]) => {
      const found = newestInLine(registry.get(name)?.versions ?? [], wanted);
      if (found === undefined) throw new Error(`${name} has no release in its line ${wanted}`);
      return [name, found];
    })
  )
});

/** The newest release of a line written `major` or `major.minor`. */
export const newestInLine = (versions: readonly string[], line: string): string | undefined => {
  const [major, minor] = line.split(".").map(Number);
  return versions
    .filter((candidate) => {
      const parsed = parseVersion(candidate);
      return (
        parsed !== undefined &&
        parsed.prerelease.length === 0 &&
        parsed.major === major &&
        (minor === undefined || parsed.minor === minor)
      );
    })
    .sort(compareVersions)
    .at(-1);
};

/** The manifest of a folder, by its path from the repository's root. */
export type ReadManifest = (folder: string) => Manifest;

/** A tool of the matrix, or a thrown error naming the key nobody defined. */
export const hostOf = (matrix: CompatMatrix, key: string): HostDefinition => {
  const host = matrix.hosts[key];
  if (host === undefined) throw new Error(`the matrix names a tool it does not define: ${key}`);
  return host;
};

/** The first npm package of a tool: the one whose versions and dist-tags are read. */
export const primaryPackage = (host: HostDefinition): string => {
  const [first] = host.packages;
  if (first === undefined) throw new Error(`the tool ${host.label} names no package`);
  return first;
};

/** The range a package claims for a tool, read where its source says. */
export const claimedRange = (
  adapter: AdapterDefinition,
  entry: AdapterHost,
  host: HostDefinition,
  readManifest: ReadManifest
): string => {
  const source: RangeSource = entry.range ?? host.range ?? { field: "peerDependencies" };
  if ("range" in source) return source.range;
  const folder = source.folder ?? adapter.folder;
  const name = primaryPackage(host);
  const range = readManifest(folder)[source.field][name];
  if (range === undefined) throw new Error(`${folder}/package.json has no ${name} in its ${source.field}`);
  return range;
};

/** The dist-tags a prerelease is never taken from: they mark old or experimental builds, not the next release. */
const IGNORED_TAGS = new Set(["latest", "experimental"]);

/** The prerelease a tool's policy picks, with its tag, or `undefined` when none is published ahead of `latest`. */
export const pickPrerelease = (
  host: HostDefinition,
  registry: RegistryPackage
): { version: string; tag: string } | undefined => {
  const policy = host.prerelease ?? "newest";
  if (policy === "none") return undefined;
  if (policy !== "newest") {
    const version = registry.distTags[policy.tag];
    return version === undefined || parseVersion(version) === undefined
      ? undefined
      : { version, tag: policy.tag };
  }
  const latest = registry.distTags["latest"];
  const candidates = Object.entries(registry.distTags)
    .filter(
      ([tag, version]) =>
        !IGNORED_TAGS.has(tag) && parseVersion(version) !== undefined && isPrerelease(version)
    )
    .filter(([, version]) => latest === undefined || compareVersions(version, latest) > 0)
    .sort(([, a], [, b]) => compareVersions(a, b));
  const newest = candidates.at(-1);
  return newest === undefined ? undefined : { version: newest[1], tag: newest[0] };
};

/** An artefact-safe id: letters, digits and dashes. */
const cellId = (...parts: readonly string[]): string =>
  parts
    .join("-")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Every cell of a run, in the matrix's order.
 *
 * @throws when a range has a clause the matrix cannot read, a line has no release, or a tool's registry entry is missing.
 */
export const planCells = (
  matrix: CompatMatrix,
  readManifest: ReadManifest,
  registry: ReadonlyMap<string, RegistryPackage>
): PlannedCell[] =>
  matrix.adapters.flatMap((adapter) =>
    adapter.hosts.flatMap((entry): PlannedCell[] => {
      const host = hostOf(matrix, entry.host);
      const name = primaryPackage(host);
      const published = registry.get(name);
      if (published === undefined) throw new Error(`no registry entry was read for ${name}`);
      const range = claimedRange(adapter, entry, host, readManifest);
      const released = caretClauses(range).map((clause): PlannedCell => {
        const version = newestInClause(published.versions, clause);
        if (version === undefined)
          throw new Error(`${name} has no release in ${clause.lower} – ${clause.upper}`);
        return {
          id: cellId(adapter.name, entry.host, clause.line),
          adapter: adapter.name,
          host: entry.host,
          range,
          line: clause.line,
          version,
          packages: packageVersions(host, clause.line, version, registry)
        };
      });
      const prerelease = pickPrerelease(host, published);
      if (prerelease === undefined) return released;
      return [
        ...released,
        {
          id: cellId(adapter.name, entry.host, "next"),
          adapter: adapter.name,
          host: entry.host,
          range,
          line: "next",
          version: prerelease.version,
          packages: packageVersions(host, "next", prerelease.version, registry),
          tag: prerelease.tag
        }
      ];
    })
  );

/** Every npm package whose registry entry a plan reads: each package of each tool the matrix uses. */
export const packagesToRead = (matrix: CompatMatrix): string[] => [
  ...new Set(
    matrix.adapters.flatMap((adapter) =>
      adapter.hosts.flatMap((entry) => {
        const host = hostOf(matrix, entry.host);
        return [
          ...host.packages,
          ...Object.values(host.companions ?? {}).flatMap((pins) => Object.keys(pins))
        ];
      })
    )
  )
];

/** The commands a cell runs, from the package's and the fixture's scripts: tests where they exist, then the build. */
export const cellCommands = (adapter: Manifest, fixture: Manifest): string[][] => [
  ...("test" in adapter.scripts ? [["pnpm", "--filter", adapter.name, "test"]] : []),
  ...("test" in fixture.scripts ? [["pnpm", "--filter", fixture.name, "test"]] : []),
  ...("build" in fixture.scripts ? [["pnpm", "--filter", fixture.name, "build"]] : [])
];
