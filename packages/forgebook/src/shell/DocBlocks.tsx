/**
 * The blocks of a docs page: its text, its code, its stories in their frames and its components' API tables.
 *
 * @remarks
 * Each kind of block is one case of `DocBlockView`, and the plugin's compiler gives each its fence, so a new kind (a
 * table of the catalogue's tokens, a comparison of a story's themes) is one type, one fence and one case, and needs no
 * page of its own. A plugin's block is one of those cases, its view loaded as the page draws it. A story's block is an example of a component's page, without its heading: the page's own text says
 * what it shows. It loads as it comes near, through the same queue as a component's examples, and its code and a
 * table's docs wait for that too.
 *
 * @module
 */
import type { StorySource } from "@forgebook/story-format/source";
import { type ReactNode, useEffect } from "react";

import { isComponentDocs } from "../componentDocs.ts";
import { type DocBlock, linkedHtml } from "../docPages.ts";
import { sourceFiles } from "../sourceFiles.ts";
import { findComponent, findStory, isLogicComponent, type StoryTree, type TreeSource } from "../storyTree.ts";
import type { ViewSwitch } from "../switches.ts";
import type { ViewState } from "../viewState.ts";
import { ApiReference } from "./ApiReference.tsx";
import { Example, type ExampleContext } from "./Example.tsx";
import { LazyHost } from "./LazyHost.tsx";
import { PackageHtml } from "./PackageHtml.tsx";
import type { ShellPlugin } from "./pluginTabs.tsx";
import { STRINGS } from "./strings.ts";
import { useComponentDocs } from "./useComponentDocs.ts";
import { useCopy } from "./useCopy.ts";
import type { PageFrames } from "./usePageFrames.ts";
import { useStoryCode } from "./useStoryCode.ts";

/** What every block of a page shares. */
export type DocBlocksContext = {
  /** The tree, where the blocks find what they name. */
  readonly tree: StoryTree;
  /** The sources, with their loaders. */
  readonly sources: readonly StorySource[];
  /** The page's frames. */
  readonly frames: PageFrames;
  /** The view. */
  readonly view: ViewState;
  /** The frame page's address. */
  readonly frameUrl: string;
  /** The plugins, whose blocks the page may hold. */
  readonly plugins: readonly ShellPlugin[];
  /** The texts the catalogue replaces, by name. */
  readonly strings: Readonly<Record<string, string>>;
  /** The catalogue's switches, for the frames' addresses. */
  readonly switches: readonly ViewSwitch[];
  /** The addresses of the page's images. */
  readonly assets: readonly string[];
  /** The address of a page of the same source, by its slug and anchor. */
  readonly pageHrefOf: (slug: string, anchor: string | undefined) => string;
  /** How a story's links open it. */
  readonly stories: Pick<ExampleContext, "hrefOf" | "onOpen">;
  /** Called when the user turns a story's finger on or off. */
  readonly onTouchChange: (storyId: string, isTouch: boolean) => void;
  /** A story's measured height, for its box while it loads. */
  readonly heightOf: (storyId: string) => number | undefined;
  /** The colour a source's stories' page has in the view, which each box waits on. */
  readonly backgroundOf: (source: TreeSource) => string | undefined;
};

/** The queue's name for a component's table, apart from the ids of the stories. */
const propsKey = (id: string): string => `props:${id}`;

/**
 * What a page's blocks load as they come near, in the page's order.
 *
 * @param blocks - the page's blocks.
 */
export const queuedBlocks = (blocks: readonly DocBlock[]): string[] =>
  blocks.flatMap((block) => {
    if (block.kind === "story") return [block.id];
    return block.kind === "props" ? [propsKey(block.id)] : [];
  });

/** A block that names what the catalogue does not have: said in place, and in the index's problems. */
const MissingBlock = ({ message }: { readonly message: string }): ReactNode => (
  <p className="forgebook-problems" role="alert">
    {message}
  </p>
);

/**
 * Code the page's text shows, with a button that copies it.
 *
 * @param props - the code as copied and as HTML.
 */
const CodeBlock = ({ text, html }: { readonly text: string; readonly html: string }): ReactNode => {
  const { isCopied, copy } = useCopy();
  return (
    <div className="forgebook-docs__code">
      <button
        type="button"
        className="forgebook-example__copy"
        onClick={(): void => copy(text)}
        aria-live="polite"
      >
        {isCopied ? STRINGS.copied : STRINGS.copy}
      </button>
      <PackageHtml className="forgebook-prose" html={`<pre><code>${html}</code></pre>`} />
    </div>
  );
};

/**
 * A story of the page, in its frame.
 *
 * @param props - the story's id, its place in the page and what the blocks share.
 */
const StoryBlock = ({
  id,
  place,
  context
}: {
  readonly id: string;
  readonly place: number;
  readonly context: DocBlocksContext;
}): ReactNode => {
  const { frames, tree, sources } = context;
  const location = findStory(tree, id);
  const source = sources.find((candidate) => candidate.id === location?.source.id);
  const isMounted = frames.queue.mounted.has(id);
  const code = useStoryCode(
    isMounted && source !== undefined && location !== undefined
      ? sourceFiles(source).code[location.component.file]
      : undefined
  );
  if (location === undefined) return <MissingBlock message={STRINGS.unknownStory(id)} />;
  return (
    <Example
      {...frames}
      {...context.stories}
      component={location.component}
      view={context.view}
      frameUrl={context.frameUrl}
      switches={context.switches}
      onTouchChange={context.onTouchChange}
      code={code}
      componentName={location.component.name}
      heightOf={context.heightOf}
      background={context.backgroundOf(location.source)}
      reading={{ hasCode: true, isCodeOpen: false, isDemoLarge: false }}
      story={location.story}
      isDemo={true}
      isMounted={isMounted}
      observe={frames.queue.observerOf(id, place)}
    />
  );
};

/**
 * A component's API table: its docs read only as it comes near, since they wait for the package's types.
 *
 * @param props - the component's id and what the blocks share.
 */
const PropsBlock = ({
  id,
  context
}: {
  readonly id: string;
  readonly context: DocBlocksContext;
}): ReactNode => {
  const { frames, tree, sources } = context;
  const { queue } = frames;
  const location = findComponent(tree, id);
  const source = sources.find((candidate) => candidate.id === location?.source.id);
  const key = propsKey(id);
  const docs = useComponentDocs(
    queue.mounted.has(key) && source !== undefined && location !== undefined
      ? sourceFiles(source).docs[location.component.file]
      : undefined
  );
  // a component with no docs is over too: "none" counts only once its turn came, since it is also the state before
  const isOver = queue.mounted.has(key) && docs.status !== "loading";
  // its place in the queue goes to the next block once it is there: a table holds no frame to wait for
  useEffect(() => {
    if (isOver) queue.markReady(key);
  }, [isOver, key, queue]);
  if (location === undefined) return <MissingBlock message={STRINGS.unknownComponent(id)} />;
  if (docs.status === "error") return <MissingBlock message={`${STRINGS.pageError}: ${docs.message}`} />;
  return (
    <div ref={queue.observerOf(key)}>
      {docs.status === "ready" && isComponentDocs(docs.value) ? (
        <ApiReference docs={docs.value} isLogic={isLogicComponent(location.component)} />
      ) : null}
    </div>
  );
};

/** Loads the host of a plugin's block. */
const loadBlockHost = async (): Promise<typeof import("./PluginBlockHost.tsx").PluginBlockHost> =>
  (await import("./PluginBlockHost.tsx")).PluginBlockHost;

/**
 * A plugin's block; a fence no plugin of this catalogue draws is said, as a block that names what is not there.
 *
 * @param props - the block and what the blocks share.
 */
const PluginBlock = ({
  block,
  context
}: {
  readonly block: Extract<DocBlock, { kind: "plugin" }>;
  readonly context: DocBlocksContext;
}): ReactNode => {
  const plugin = context.plugins.find((each) =>
    each.docBlocks.some((candidate) => candidate.fence === block.fence)
  );
  const load = plugin?.docBlocks.find((candidate) => candidate.fence === block.fence)?.load;
  if (plugin === undefined || load === undefined) return <MissingBlock message={block.fence} />;
  return (
    <LazyHost
      loadHost={loadBlockHost}
      props={{
        load,
        pluginId: plugin.id,
        argument: block.argument,
        body: block.body,
        page: context
      }}
    />
  );
};

/**
 * One block of a page.
 *
 * @param props - the block, its place in the page and what the blocks share.
 */
const DocBlockView = ({
  block,
  place,
  context
}: {
  readonly block: DocBlock;
  readonly place: number;
  readonly context: DocBlocksContext;
}): ReactNode => {
  switch (block.kind) {
    case "text":
      return (
        <PackageHtml
          className="forgebook-prose"
          html={linkedHtml(block.html, context.pageHrefOf, context.assets)}
        />
      );
    case "code":
      return <CodeBlock text={block.text} html={block.html} />;
    case "story":
      return <StoryBlock id={block.id} place={place} context={context} />;
    case "props":
      return <PropsBlock id={block.id} context={context} />;
    case "plugin":
      return <PluginBlock block={block} context={context} />;
    default:
      return null;
  }
};

/**
 * A page's blocks, in the order of its file.
 *
 * @param props - the blocks and what they share.
 */
export const DocBlocks = ({
  blocks,
  context
}: {
  readonly blocks: readonly DocBlock[];
  readonly context: DocBlocksContext;
}): ReactNode =>
  blocks.map((block, place) => (
    // the blocks of one page never reorder, so their place is a stable key, and a story may be shown twice
    // biome-ignore lint/suspicious/noArrayIndexKey: see above
    <DocBlockView key={place} block={block} place={place} context={context} />
  ));
