/**
 * The catalogue's own browser tests: the shell and its frames, on the fixture catalogue (`forgebook.config.ts`), the flows
 * the unit tests cannot reach (the address, the panel, the stage, the keys, the errors).
 *
 * @remarks
 * Run with `pnpm --filter @fixture/app test:shell`. The ports come from `FORGEBOOK_SHELL_PORT` (`ports.ts`), so two
 * worktrees can run the tests at once. The Vue, Svelte, Solid, Preact, Web Components, plain HTML, Angular, SvelteKit,
 * Next.js, Nuxt, React Native and white-label catalogues run beside the fixture app, for what a catalogue of another
 * framework must do (`vue.e2e.ts`, `svelte.e2e.ts`, `solid.e2e.ts`, `preact.e2e.ts`, `webComponents.e2e.ts`,
 * `html.e2e.ts`, `angular.e2e.ts`), what a SvelteKit, Next.js, Nuxt or React Native project's components need
 * (`sveltekit.e2e.ts`, `nextjs.e2e.ts`, `nuxt.e2e.ts`, `reactNative.e2e.ts`) and a catalogue with no trace of
 * Forgebook's look (`embed.e2e.ts`).
 *
 * `FORGEBOOK_SHELL_GROUP=<index>/<count>` runs one group of catalogues and their specs instead of all of them at once
 * (`catalogueGroups.ts`), for a machine whose memory does not hold every dev server together.
 *
 * The specs that edit fixture files run in a project of their own, `story file edits`, on one worker, once the other
 * specs are over; every other spec runs in `catalogues`, in parallel.
 *
 * @module
 */
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

import { runGroup } from "./catalogueGroups";
import { type Catalogue, catalogueUrl, framesPortOf, portOf } from "./ports";

/**
 * The catalogues whose dev server notices edits by polling (`--poll`): the fixture app's, whose files the
 * `story file edits` specs write. On a busy machine the system's change events come seconds late, past an assertion's
 * wait; polling checks the files itself, every 100 ms, without the system's event service.
 */
const POLLING_CATALOGUES: readonly Catalogue[] = ["app"];

/**
 * A catalogue as an app runs it: the forgebook command over its configuration, no page of its own; with a cold
 * dependency cache every run, as a first start, so a page that reloads while Vite discovers a package fails here.
 *
 * @param folder - the catalogue's folder.
 * @param catalogue - which catalogue it is, for its ports (`ports.ts`): its frames listen on their own.
 * @param configFile - its configuration, relative to the folder; the folder's `forgebook.config.ts` when absent.
 */
const catalogueServer = (
  folder: string,
  catalogue: Catalogue,
  configFile?: string
): { command: string; cwd: string; url: string; reuseExistingServer: boolean } => ({
  command: `pnpm exec forgebook dev${configFile === undefined ? "" : ` --config ${configFile}`} --host 127.0.0.1 --port ${portOf(catalogue)} --frame-port ${framesPortOf(catalogue)} --force${POLLING_CATALOGUES.includes(catalogue) ? " --poll" : ""}`,
  cwd: folder,
  url: catalogueUrl(catalogue),
  reuseExistingServer: false
});

/** Each catalogue's server: its folder, and its configuration when not the folder's `forgebook.config.ts`. */
const SERVERS: Readonly<Record<Catalogue, { folder: string; configFile?: string }>> = {
  app: { folder: join(import.meta.dirname, "..") },
  vue: { folder: join(import.meta.dirname, "..", "..", "vue") },
  svelte: { folder: join(import.meta.dirname, "..", "..", "svelte") },
  solid: { folder: join(import.meta.dirname, "..", "..", "solid") },
  preact: { folder: join(import.meta.dirname, "..", "..", "preact") },
  "web-components": { folder: join(import.meta.dirname, "..", "..", "web-components") },
  html: { folder: join(import.meta.dirname, "..", "..", "html") },
  // a second catalogue, for what only shows on one that sets a whole theme and turns the branding off
  "white-label": { folder: join(import.meta.dirname, ".."), configFile: "white-label/forgebook.config.ts" },
  nextjs: { folder: join(import.meta.dirname, "..", "..", "nextjs") },
  nuxt: { folder: join(import.meta.dirname, "..", "..", "nuxt") },
  angular: { folder: join(import.meta.dirname, "..", "..", "angular") },
  sveltekit: { folder: join(import.meta.dirname, "..", "..", "sveltekit") },
  "react-native": { folder: join(import.meta.dirname, "..", "..", "react-native") },
  // a catalogue with several visual themes, for its gallery and what a value brings with it (`gallery.e2e.ts`)
  themes: { folder: join(import.meta.dirname, ".."), configFile: "themes/forgebook.config.ts" },
  // the fixture app without its written home, for the home every catalogue without one keeps (`home.e2e.ts`)
  "generated-home": { folder: join(import.meta.dirname, ".."), configFile: "forgebook.generated.config.ts" },
  // the kit with accessibility checks and component docs off, for what a catalogue offers without them (`parity.e2e.ts`)
  parity: { folder: join(import.meta.dirname, ".."), configFile: "parity/forgebook.config.ts" },
  // the kit composing a built catalogue with `refs`, served by its spec (`refs.e2e.ts`)
  refs: { folder: join(import.meta.dirname, ".."), configFile: "refs/forgebook.config.ts" }
};

/** The catalogues and specs this run takes: all of them, or one group (`catalogueGroups.ts`). */
const group = runGroup(import.meta.dirname);

/**
 * The specs that edit committed fixture files while the catalogue serves them (`fileEdits.ts`): run on one worker, so
 * no two of their tests, nor two repetitions of one (`--repeat-each`), edit the same file at once.
 */
const EDITING_SPECS: readonly string[] = ["hotEdit.e2e.ts"];

/** This run's specs that edit fixture files. */
const editingSpecs = group.specs.filter((spec) => EDITING_SPECS.includes(spec));

/** This run's other specs. */
const otherSpecs = group.specs.filter((spec) => !EDITING_SPECS.includes(spec));

export default defineConfig({
  testDir: import.meta.dirname,
  projects: [
    ...(otherSpecs.length === 0 ? [] : [{ name: "catalogues", testMatch: otherSpecs }]),
    ...(editingSpecs.length === 0
      ? []
      : [
          {
            name: "story file edits",
            testMatch: editingSpecs,
            workers: 1,
            // after the others: a story file left broken shows Vite's overlay on every open page of the catalogue, and
            // its fix reloads the pages opened meanwhile, which another spec's test may be reading
            ...(otherSpecs.length === 0 ? {} : { dependencies: ["catalogues"] })
          }
        ])
  ],
  // a group keeps its results apart, so the next group's run does not clear a failure before it
  ...(group.place === undefined
    ? {}
    : { outputDir: join(import.meta.dirname, "..", "test-results", `group-${group.place.index}`) }),
  fullyParallel: true,
  reporter: [["list"]],
  webServer: group.catalogues.map((catalogue) =>
    catalogueServer(SERVERS[catalogue].folder, catalogue, SERVERS[catalogue].configFile)
  ),
  use: {
    browserName: "chromium",
    baseURL: catalogueUrl("app"),
    viewport: { width: 1280, height: 900 }
  }
});
