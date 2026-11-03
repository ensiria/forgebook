/**
 * What the measurements are taken on, as they need it: a story and a component's page, the texts that show they are
 * drawn, a group of the sidebar, and how a file is edited. A generated library and a real one both come down to this,
 * so `measure.ts` holds one definition of each metric.
 *
 * @module
 */
import { join } from "node:path";

import type { CorpusComponent } from "./corpus.ts";
import { editedText } from "./realCorpus.ts";
import type { CorpusPaths, RealCorpus } from "./realCorpus.types.ts";
import type { StampWatch } from "./stamps.ts";
import type { Target } from "./targets.ts";

/** The kind of file an edit touches. */
export type EditKind = "story" | "component";

/** An edit of a file. */
export type EditPlan = {
  /** The file, absolute. */
  readonly file: string;
  /** The file's text with a mark in it, what the page then shows. */
  readonly text: (original: string, mark: string) => string;
  /** The mark of one edit. */
  readonly mark: (edit: number) => string;
};

/** What a measurement is taken on. */
export type MeasureSubject = {
  /** The story's address on a server. */
  readonly storyAddress: (base: string) => string;
  /** The component's page's address, when this tool has one. */
  readonly pageAddress: ((base: string) => string) | undefined;
  /** What says the story is drawn. */
  readonly storyKey: string;
  /** What says the component's page is drawn. */
  readonly pageKeys: readonly string[];
  /** A group of the sidebar, in the top page once the index arrived. */
  readonly sidebar: string;
  /** What the page watches, besides the sidebar and the props table. */
  readonly watch: Pick<StampWatch, "frameTexts" | "frameMark">;
  /** The edit of a kind. */
  readonly edit: (kind: EditKind) => EditPlan;
};

/** A group of the sidebar, taken from the generated titles. */
const GENERATED_SIDEBAR = "Overlays";

/**
 * The subject of a generated library: its measured component, as this tool addresses it.
 *
 * @param target - the tool.
 * @param component - the component.
 * @param directory - the project's folder.
 */
export const generatedSubject = (
  target: Target,
  component: CorpusComponent,
  directory: string
): MeasureSubject => {
  const { componentUrl } = target;
  const edited = (name: string, before: RegExp, replacement: (mark: string) => string): EditPlan => ({
    file: join(directory, "src/components", name),
    text: (original, mark) => original.replace(before, replacement(mark)),
    mark: (edit) => `edit ${edit}`
  });
  return {
    storyAddress: (base) => target.storyUrl(base, component),
    pageAddress: componentUrl === undefined ? undefined : (base) => componentUrl(base, component),
    storyKey: component.stories[0]?.label ?? "",
    pageKeys: component.stories.map((story) => story.label),
    sidebar: GENERATED_SIDEBAR,
    watch: {},
    edit: (kind) =>
      kind === "story"
        ? edited(`${component.name}.stories.tsx`, /label: "[^"]*"/, (mark) => `label: "${mark}"`)
        : edited(`${component.name}.tsx`, /const BUILD = "[^"]*"/, (mark) => `const BUILD = "${mark}"`)
  };
};

/** The mark an edit of a real file writes: long enough that no story of a library holds it. */
const REAL_MARK = "bench-edit-";

/** The ids of the story and the page in one tool. */
type ToolIds = {
  /** The story's address on a server. */
  readonly story: (base: string) => string;
  /** The component's page's address, when it has one. */
  readonly page: ((base: string) => string) | undefined;
};

/** Each tool's addresses of the corpus's story and page. */
const realAddresses = (target: Target, corpus: RealCorpus): ToolIds => {
  const { forgebookStory, forgebookComponent, storybookStory, storybookDocs } = corpus.measured;
  if (target.name === "forgebook") {
    return {
      story: (base) => `${base}?story=${encodeURIComponent(forgebookStory)}`,
      page: (base) => `${base}?component=${encodeURIComponent(forgebookComponent)}`
    };
  }
  return {
    story: (base) => `${base}?path=/story/${storybookStory ?? ""}`,
    page: storybookDocs === undefined ? undefined : (base) => `${base}?path=/docs/${storybookDocs}`
  };
};

/**
 * The subject of a real corpus, as this tool addresses it.
 *
 * @param target - the tool.
 * @param corpus - the corpus.
 * @param paths - where it lives.
 */
export const realSubject = (target: Target, corpus: RealCorpus, paths: CorpusPaths): MeasureSubject => {
  const { story, page } = realAddresses(target, corpus);
  const { text, pageText, sidebar } = corpus.measured;
  return {
    storyAddress: story,
    pageAddress: page,
    storyKey: text,
    pageKeys: [pageText],
    sidebar,
    watch: { frameTexts: [...new Set([text, pageText])], frameMark: `${REAL_MARK}\\d+` },
    edit: (kind) => ({
      file: join(paths.catalogue, corpus.edits[kind].file),
      text: (original, mark) => editedText(original, corpus.edits[kind], mark),
      mark: (edit) => `${REAL_MARK}${edit}`
    })
  };
};
