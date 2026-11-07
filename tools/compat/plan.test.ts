/**
 * The plan: lines from the ranges packages claim, the prerelease each tool's policy picks, the commands a cell runs;
 * and the real matrix kept readable against the real manifests.
 *
 * @module
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { CompatMatrix, Manifest, RegistryPackage } from "./compat.types.ts";
import { parseManifest } from "./documents.ts";
import { COMPAT_MATRIX } from "./matrix.ts";
import {
  cellCommands,
  claimedRange,
  companionVersion,
  hostOf,
  newestInLine,
  packagesToRead,
  pickPrerelease,
  planCells
} from "./plan.ts";

/** A manifest with only what a test sets. */
const manifest = (fields: Partial<Manifest>): Manifest => ({
  name: "x",
  scripts: {},
  peerDependencies: {},
  dependencies: {},
  ...fields
});

const MATRIX: CompatMatrix = {
  hosts: {
    react: { label: "React", packages: ["react", "react-dom"], prerelease: { tag: "canary" } },
    vite: { label: "Vite", packages: ["vite"], range: { field: "dependencies", folder: "packages/core" } },
    kit: { label: "Kit", packages: ["kit"], prerelease: "none" }
  },
  adapters: [
    {
      name: "@x/react",
      folder: "packages/react",
      fixture: "fixtures/react",
      hosts: [
        { host: "react" },
        { host: "vite" },
        { host: "kit", range: { range: "^2.0.0", why: "its README" } }
      ]
    }
  ]
};

const MANIFESTS: Record<string, Manifest> = {
  "packages/react": manifest({ name: "@x/react", peerDependencies: { react: "^18.2.0 || ^19.0.0" } }),
  "packages/core": manifest({ name: "core", dependencies: { vite: "^8.3.4" } })
};

const readManifest = (folder: string): Manifest => {
  const found = MANIFESTS[folder];
  if (found === undefined) throw new Error(`no manifest for ${folder}`);
  return found;
};

const REGISTRY = new Map<string, RegistryPackage>([
  [
    "react",
    {
      versions: ["18.2.0", "18.3.1", "19.0.0", "19.3.1", "19.3.0-canary-abc-20261106"],
      distTags: { latest: "19.3.1", canary: "19.3.0-canary-abc-20261106" }
    }
  ],
  [
    "vite",
    {
      versions: ["8.3.4", "8.3.6", "9.0.0-beta.1"],
      distTags: {
        latest: "8.3.6",
        beta: "9.0.0-beta.1",
        alpha: "6.0.0-alpha.24",
        experimental: "10.0.0-exp.1"
      }
    }
  ],
  [
    "react-dom",
    {
      versions: ["18.3.1", "19.3.0", "19.3.2", "19.3.0-canary-abc-20261106"],
      distTags: { latest: "19.3.2" }
    }
  ],
  [
    "kit",
    { versions: ["2.0.0", "2.5.0", "3.0.0-next.1"], distTags: { latest: "2.5.0", next: "3.0.0-next.1" } }
  ]
]);

describe("planCells", () => {
  it("tests the newest release of each line the range claims, then the prerelease its policy picks", () => {
    expect(planCells(MATRIX, readManifest, REGISTRY)).toEqual([
      {
        id: "x-react-react-18",
        adapter: "@x/react",
        host: "react",
        range: "^18.2.0 || ^19.0.0",
        line: "18",
        version: "18.3.1",
        packages: { react: "18.3.1", "react-dom": "18.3.1" }
      },
      {
        id: "x-react-react-19",
        adapter: "@x/react",
        host: "react",
        range: "^18.2.0 || ^19.0.0",
        line: "19",
        version: "19.3.1",
        packages: { react: "19.3.1", "react-dom": "19.3.2" }
      },
      {
        id: "x-react-react-next",
        adapter: "@x/react",
        host: "react",
        range: "^18.2.0 || ^19.0.0",
        line: "next",
        version: "19.3.0-canary-abc-20261106",
        packages: { react: "19.3.0-canary-abc-20261106", "react-dom": "19.3.0-canary-abc-20261106" },
        tag: "canary"
      },
      {
        id: "x-react-vite-8",
        adapter: "@x/react",
        host: "vite",
        range: "^8.3.4",
        line: "8",
        version: "8.3.6",
        packages: { vite: "8.3.6" }
      },
      {
        id: "x-react-vite-next",
        adapter: "@x/react",
        host: "vite",
        range: "^8.3.4",
        line: "next",
        version: "9.0.0-beta.1",
        packages: { vite: "9.0.0-beta.1" },
        tag: "beta"
      },
      {
        id: "x-react-kit-2",
        adapter: "@x/react",
        host: "kit",
        range: "^2.0.0",
        line: "2",
        version: "2.5.0",
        packages: { kit: "2.5.0" }
      }
    ]);
  });

  it("stops on a line nobody released, rather than leave it out of the table quietly", () => {
    const registry = new Map(REGISTRY);
    registry.set("react", { versions: ["19.3.1"], distTags: { latest: "19.3.1" } });
    expect(() => planCells(MATRIX, readManifest, registry)).toThrow("react has no release in 18.2.0");
  });
});

describe("companionVersion", () => {
  it("takes the same version, else the newest of the same minor, else the same version", () => {
    const published = { versions: ["22.2.4", "22.2.6", "22.3.0-next.1"], distTags: {} };
    expect(companionVersion("22.2.4", published)).toBe("22.2.4");
    expect(companionVersion("22.2.5", published)).toBe("22.2.6");
    expect(companionVersion("23.0.0", published)).toBe("23.0.0");
    expect(companionVersion("22.3.0-next.1", published)).toBe("22.3.0-next.1");
  });
});

describe("newestInLine", () => {
  it("takes the newest release of a major or of a minor", () => {
    const versions = ["5.8.3", "5.9.2", "5.9.3", "6.0.3", "5.10.0-beta"];
    expect(newestInLine(versions, "5.9")).toBe("5.9.3");
    expect(newestInLine(versions, "5")).toBe("5.9.3");
    expect(newestInLine(versions, "7")).toBeUndefined();
  });
});

describe("pickPrerelease", () => {
  it("takes the newest prerelease ahead of latest, and none behind it", () => {
    const host = { label: "Vite", packages: ["vite"] };
    expect(
      pickPrerelease(host, { versions: [], distTags: { latest: "8.3.6", beta: "8.3.0-beta.1" } })
    ).toBeUndefined();
    expect(
      pickPrerelease(host, {
        versions: [],
        distTags: { latest: "3.5.45", beta: "3.6.0-beta.17", rc: "3.6.0-rc.14" }
      })
    ).toEqual({ version: "3.6.0-rc.14", tag: "rc" });
  });
});

describe("claimedRange", () => {
  it("names the manifest and field that lack the range", () => {
    const [adapter] = MATRIX.adapters;
    if (adapter === undefined) throw new Error("no adapter");
    const noPeer = (): Manifest => manifest({});
    expect(() => claimedRange(adapter, { host: "react" }, hostOf(MATRIX, "react"), noPeer)).toThrow(
      "packages/react/package.json has no react in its peerDependencies"
    );
  });
});

describe("cellCommands", () => {
  it("runs the package's tests, the fixture's tests, then the fixture's build, each only when it exists", () => {
    const adapter = manifest({ name: "@x/react", scripts: { test: "vitest run" } });
    expect(
      cellCommands(adapter, manifest({ name: "@fixture/a", scripts: { test: "t", build: "b" } }))
    ).toEqual([
      ["pnpm", "--filter", "@x/react", "test"],
      ["pnpm", "--filter", "@fixture/a", "test"],
      ["pnpm", "--filter", "@fixture/a", "build"]
    ]);
    expect(
      cellCommands(manifest({ name: "y" }), manifest({ name: "@fixture/b", scripts: { build: "b" } }))
    ).toEqual([["pnpm", "--filter", "@fixture/b", "build"]]);
  });
});

describe("the repository's matrix", () => {
  const root = resolve(import.meta.dirname, "../..");
  const readReal = (folder: string): Manifest =>
    parseManifest(readFileSync(join(root, folder, "package.json"), "utf8"), folder);

  it("names folders that exist and tools it defines, and reads every range it claims", () => {
    for (const adapter of COMPAT_MATRIX.adapters) {
      expect(readReal(adapter.folder).name).toBe(adapter.name);
      expect(existsSync(join(root, adapter.fixture, "package.json"))).toBe(true);
      expect("build" in readReal(adapter.fixture).scripts).toBe(true);
      for (const entry of adapter.hosts)
        expect(claimedRange(adapter, entry, hostOf(COMPAT_MATRIX, entry.host), readReal)).not.toBe("");
    }
    expect(packagesToRead(COMPAT_MATRIX)).toContain("vite");
  });

  it("covers every published package that draws stories", () => {
    const tested = new Set(COMPAT_MATRIX.adapters.map((adapter) => adapter.folder));
    const renderers = [
      "react",
      "vue",
      "svelte",
      "solid",
      "preact",
      "web-components",
      "html",
      "angular",
      "nextjs",
      "nuxt",
      "sveltekit",
      "react-native-web"
    ];
    for (const folder of renderers) expect(tested).toContain(`packages/${folder}`);
  });
});
