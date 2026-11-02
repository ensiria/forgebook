/**
 * Tests for reading a SvelteKit project: SvelteKit 3's options from its Vite configuration, SvelteKit 2's from
 * `svelte.config.js`, its routes and static files from its folders.
 *
 * @module
 */
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadKitProject } from "../../src/vite/kitProject.ts";
import { projectRoutes, projectStaticFiles } from "../../src/vite/projectFiles.ts";

/** The test projects' folder. */
const FIXTURES = join(import.meta.dirname, "..", "fixtures");

describe("loadKitProject", () => {
  it("reads SvelteKit 3's options from the project's Vite configuration, and keeps its other plugins", async () => {
    const project = await loadKitProject(join(FIXTURES, "kit3"), undefined);
    expect(project.problem).toBeUndefined();
    expect(project.kit["paths"]).toMatchObject({ base: "/docs" });
    expect(project.kit["version"]).toMatchObject({ name: "3.0.0" });
    expect(project.svelte).toMatchObject({ configFile: false, compilerOptions: { runes: true } });
    expect(
      project.plugins.map((plugin) =>
        typeof plugin === "object" && plugin !== null && "name" in plugin ? plugin.name : ""
      )
    ).toEqual(["project:own"]);
  });

  it("reads SvelteKit 2's options from svelte.config.js when the Vite configuration is not read", async () => {
    const project = await loadKitProject(join(FIXTURES, "kit2"), false);
    expect(project.kit["files"]).toEqual({ lib: "src/library" });
    expect(project.svelte).toBeUndefined();
    expect(project.plugins).toEqual([]);
  });

  it("says why a Vite configuration named by the catalogue cannot be read", async () => {
    const project = await loadKitProject(join(FIXTURES, "kit2"), "missing.config.ts");
    expect(project.problem).toContain("could not be loaded");
  });
});

describe("the project's files", () => {
  it("lists the routes with a page or an endpoint, groups and params kept in their ids", () => {
    expect(projectRoutes(join(FIXTURES, "kit3", "src", "routes"), [".svelte"])).toEqual([
      { id: "/", page: true, endpoint: false },
      { id: "/(app)/settings", page: true, endpoint: false },
      { id: "/api/posts", page: false, endpoint: true },
      { id: "/blog/[slug]", page: true, endpoint: false }
    ]);
    expect(projectRoutes(join(FIXTURES, "none"), [".svelte"])).toEqual([]);
  });

  it("lists the static files from their folder", () => {
    expect(projectStaticFiles(join(FIXTURES, "kit3", "static"))).toEqual(["favicon.png", "img/logo.svg"]);
  });
});
