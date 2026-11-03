/**
 * The shape of a real corpus: a public library at a pinned commit, as `corpora/<name>/corpus.json` describes it.
 *
 * @module
 */

/** A command, as words: run without a shell, so nothing in a definition is interpreted. */
export type CorpusCommand = readonly string[];

/** An edit of a pinned file, for the HMR metrics. */
export type CorpusEdit = {
  /** The file, from the catalogue's folder. */
  readonly file: string;
  /** The text replaced: it must be in the file. */
  readonly find: string;
  /** What replaces it, with `{edit}` where the edit's mark goes, in text the story shows. */
  readonly replace: string;
};

/** What the start, HMR and page metrics are taken on. */
export type CorpusMeasured = {
  /** The story's id in Forgebook. */
  readonly forgebookStory: string;
  /** The component's id in Forgebook. */
  readonly forgebookComponent: string;
  /** A text the story draws, looked for inside the frame only: the top page has its own texts. */
  readonly text: string;
  /** A text in the component's page, once its stories are drawn. */
  readonly pageText: string;
  /** A group of the sidebar, seen when the index arrived. */
  readonly sidebar: string;
  /** The story's id in Storybook, when the corpus runs its Storybook. */
  readonly storybookStory?: string;
  /** The component's docs page's id in Storybook, when it has one. */
  readonly storybookDocs?: string;
};

/** How the library's own Storybook runs: its version, its configuration and its addons, as its users get them. */
export type CorpusStorybook = {
  /** The folder Storybook runs in, from the clone's root. */
  readonly folder: string;
  /** Its configuration's folder, from `folder`. */
  readonly configDir: string;
  /** What it needs in its environment. */
  readonly env?: Readonly<Record<string, string>>;
};

/** A real corpus. */
export type RealCorpus = {
  /** Its name: the folder under `corpora/`. */
  readonly name: string;
  /** The repository, public, by HTTPS: no credentials are needed. */
  readonly repository: string;
  /** The commit, in full: never a branch or a tag, which move. */
  readonly commit: string;
  /** Its licence's SPDX id. */
  readonly licence: string;
  /** What it installs its dependencies with, from the clone's root, with lifecycle scripts off. */
  readonly install: CorpusCommand;
  /** What the stories need built after the install, from the clone's root; nothing by default. */
  readonly prepare?: readonly CorpusCommand[];
  /** The folder the catalogue stands in, from the clone's root. */
  readonly folder: string;
  /** What Storybook's own indexer counts at this commit: a run that finds another number fails. */
  readonly expected: { readonly files: number; readonly stories: number };
  /** The story and the component measured. */
  readonly measured: CorpusMeasured;
  /** The edits, of a story file and of a component. */
  readonly edits: { readonly story: CorpusEdit; readonly component: CorpusEdit };
  /** Its Storybook, when it can run from the clone; none measures Forgebook alone. */
  readonly storybook?: CorpusStorybook;
};

/** Where a corpus lives on disk. */
export type CorpusPaths = {
  /** The definition's folder, whose files are copied beside the stories. */
  readonly definition: string;
  /** The clone. */
  readonly clone: string;
  /** The folder Forgebook is installed in and runs from, inside the catalogue's folder. */
  readonly bench: string;
  /** The catalogue's folder, in the clone. */
  readonly catalogue: string;
};
