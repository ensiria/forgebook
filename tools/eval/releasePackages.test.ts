/**
 * Each package's version in a release of the core, from the release commit's manifests.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { packageName, releaseTag, releaseVersions } from "./releasePackages.ts";

/** A release whose packages went out at different versions, as `forgebook@0.4.0` did. */
const RELEASE: Readonly<Record<string, string>> = {
  forgebook: "0.4.0",
  "story-format": "0.3.0",
  testing: "0.2.5",
  react: "0.2.5"
};

/** A folder's manifest in the release, or none when the release has no such package. */
const manifestOf = (folder: string): string | undefined => {
  const version = RELEASE[folder];
  return version === undefined ? undefined : JSON.stringify({ name: packageName(folder), version });
};

describe("a release's packages", () => {
  it("names the release by the core's tag", () => {
    expect(releaseTag("0.4.0")).toBe("forgebook@0.4.0");
  });

  it("gives each package the version it went out at, not the core's", () => {
    expect(releaseVersions(["story-format", "forgebook", "testing", "react"], manifestOf)).toEqual({
      "@forgebook/story-format": "0.3.0",
      forgebook: "0.4.0",
      "@forgebook/testing": "0.2.5",
      "@forgebook/react": "0.2.5"
    });
  });

  it("refuses a package the release does not have", () => {
    expect(() => releaseVersions(["vue"], manifestOf)).toThrow("@forgebook/vue is not part of this release");
  });

  it("refuses a manifest that names another package or no version", () => {
    expect(() =>
      releaseVersions(["react"], () => JSON.stringify({ name: "react", version: "19.0.0" }))
    ).toThrow("does not name @forgebook/react");
    expect(() => releaseVersions(["react"], () => JSON.stringify({ name: "@forgebook/react" }))).toThrow(
      "names no version"
    );
  });
});
