/**
 * The versions of Forgebook's packages that make up one release of the core, read from the release's tag.
 *
 * @remarks
 * Forgebook's packages are versioned independently: `forgebook@0.4.0` shipped with `@forgebook/story-format@0.3.0`
 * and `@forgebook/react@0.2.5`, so one version number cannot name them all. A release is one commit, tagged once per
 * package published from it, and each package's manifest in that commit holds the version it went out at, so the tag
 * `forgebook@<version>` gives every other package's version too. The core's published manifest names only the story
 * format among its dependencies, and the registry's publish times put a package published a minute after the core
 * outside its release, so neither can say which adapter or testing package belongs to a release.
 *
 * @module
 */
import type { ScriptIo } from "@ensiria/cli-kit/io.types";

import { git } from "./workspace.ts";

/** The name of the core package, whose version names a release. */
const CORE = "forgebook";

/**
 * The package name of a folder under `packages/`.
 *
 * @param folder - the folder's name.
 */
export const packageName = (folder: string): string => (folder === CORE ? folder : `@forgebook/${folder}`);

/**
 * The tag a release of the core is published under.
 *
 * @param version - the core's version.
 */
export const releaseTag = (version: string): string => `${CORE}@${version}`;

/**
 * Each package's version in a release, from the manifests of the release's commit.
 *
 * @param folders - the packages wanted, as folders under `packages/`.
 * @param manifestOf - a folder's `package.json` text in the release's commit, or `undefined` when it has none.
 * @throws when a package is not in the release, or its manifest names another package or no version.
 */
export const releaseVersions = (
  folders: readonly string[],
  manifestOf: (folder: string) => string | undefined
): Readonly<Record<string, string>> => {
  const versions: Record<string, string> = {};
  for (const folder of folders) {
    const name = packageName(folder);
    const text = manifestOf(folder);
    if (text === undefined) throw new Error(`${name} is not part of this release`);
    const manifest: unknown = JSON.parse(text);
    if (typeof manifest !== "object" || manifest === null)
      throw new Error(`${name}'s manifest is not an object`);
    if (!("name" in manifest) || manifest.name !== name)
      throw new Error(`packages/${folder}/package.json does not name ${name}`);
    if (!("version" in manifest) || typeof manifest.version !== "string")
      throw new Error(`${name}'s manifest names no version`);
    versions[name] = manifest.version;
  }
  return versions;
};

/** What `releasePackages` needs. */
export type ReleaseRequest = {
  /** The repository, holding the release tags. */
  readonly repository: string;
  /** The core's version that names the release. */
  readonly version: string;
  /** The packages wanted, as folders under `packages/`. */
  readonly folders: readonly string[];
  /** The script's streams. */
  readonly io: ScriptIo;
};

/**
 * Each package's version in the release named by the core's version, read from the repository's tag of that release.
 *
 * @param request - the release and the packages wanted.
 * @throws when the repository has no tag for the release, or a package is not in it.
 */
export const releasePackages = async (request: ReleaseRequest): Promise<Readonly<Record<string, string>>> => {
  const { repository, version, folders, io } = request;
  const tag = releaseTag(version);
  const commit = (
    await git(["rev-parse", "--verify", "--quiet", `refs/tags/${tag}^{commit}`], {
      cwd: repository,
      io,
      check: false
    })
  ).trim();
  if (commit === "")
    throw new Error(`no tag ${tag} in ${repository}: fetch the release tags (git fetch --tags origin)`);
  const listed = new Set(
    (await git(["ls-tree", "--name-only", `${commit}:packages`], { cwd: repository, io })).split("\n")
  );
  const manifests = new Map<string, string>();
  for (const folder of folders) {
    if (!listed.has(folder)) continue;
    manifests.set(
      folder,
      await git(["show", `${commit}:packages/${folder}/package.json`], { cwd: repository, io })
    );
  }
  return releaseVersions(folders, (folder) => manifests.get(folder));
};
