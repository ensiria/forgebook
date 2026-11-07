/**
 * Every breaking change of `forgebook` since 0.3: those with a mechanical rewrite as codemods, the others as notes saying
 * what to do by hand. A breaking change adds its entry here in the same pull request (CONTRIBUTING.md, "Version policy").
 *
 * @module
 */
import type { Codemod, MigrationNote } from "./migrate.types.ts";
import { playOnInBuilds } from "./playOnInBuilds.ts";
import { propGroupStrings } from "./propGroupStrings.ts";

/** The codemods, oldest change first. */
export const CODEMODS: readonly Codemod[] = [propGroupStrings, playOnInBuilds];

/** The breaking changes no codemod can make, oldest first, each keyed on its own package's version. */
export const MIGRATION_NOTES: readonly MigrationNote[] = [
  {
    id: "config-unknown-keys",
    package: "forgebook",
    breaksIn: "0.4.0",
    text: 'A configuration with a key nothing reads now stops every command, naming it (it has no key "toolbr". Did you mean toolbar?): fix or remove the key it names.'
  },
  {
    id: "config-refused-settings",
    package: "forgebook",
    breaksIn: "0.4.0",
    text: "A toolbar naming no control, and a story pattern matching no file, now stop build, stories and check (dev warns on the pattern): fix what the message names."
  },
  {
    id: "app-build",
    package: "forgebook",
    breaksIn: "0.4.0",
    text: "The catalogue now draws stories with the app's own build: tsconfig paths, the vite.config beside the configuration (which runs its code) and the project's PostCSS. A catalogue that set these up by hand may get them twice: appBuild: false reads none, and each part can be turned off."
  },
  {
    id: "verify-schema-2",
    package: "forgebook",
    breaksIn: "0.4.0",
    text: "verify exits non-zero on a changed UI file with no story that ran, and its JSON is schema 2 (verdict, summary, skipped, base, variants, uiFiles, storyCount, ran, failures, code; reports is gone): update what reads it, and write the stories it asks for."
  },
  {
    id: "app-tokens",
    package: "forgebook",
    breaksIn: "0.4.0",
    text: "With no tokens file, check-code and verify read the design system the application declares (custom properties, Tailwind, components.json) and can fail on raw colours and sizes: use the tokens they name, or write tokens: [] to say there is no system."
  },
  {
    id: "style-object-sizes",
    package: "forgebook",
    breaksIn: "0.4.0",
    text: "check-code compares a bare number under a spacing, radius or font-size key in a React style object (style={{ padding: 12 }}) with the size tokens, and fails on one with no token: use the token it names, or excuse a meant value with a forgebook-ignore comment."
  },
  {
    id: "duplicate-component",
    package: "forgebook",
    breaksIn: "0.4.0",
    text: "check-code and verify can fail on duplicate-component, and on an import of a component marked @deprecated or @replacedBy: use the component they name, or excuse a meant one with a forgebook-ignore comment."
  },
  {
    id: "unseen-components",
    package: "forgebook",
    breaksIn: "0.4.0",
    text: "verify fails on a changed component a package publishes when agents cannot see it (no story, every story !dev, no props, no TSDoc): forgebook visibility lists them with their fix."
  },
  {
    id: "story-file-code",
    package: "@forgebook/story-format",
    breaksIn: "0.3.0",
    text: 'For code reading a story file\'s module: StoryFileCode entries are StoryCode | StoryArgsCode; narrow with "text" in entry before reading .text.'
  }
];
