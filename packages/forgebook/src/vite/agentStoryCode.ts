/**
 * A story's code as `forgebook story` and the `get_story` tool give it: the same text the Code tab shows and copies
 * (`storyCodeText.ts`), with the values an agent asked to set written from their values.
 *
 * @remarks
 * The framework's code writer is the module the shell imports (`FrameworkAdapter.pages.code`), loaded on the dev server:
 * the writers are plain functions with no browser in them. Without it, or without the story file's code, there is no
 * text, and the reason is a problem of the answer.
 *
 * @module
 */
import type { StoryFileCode } from "@forgebook/story-format/source";

import { type ComponentDocs, codeNameOf } from "../componentDocs.ts";
import { panelArgsOf } from "../frame/panelValues.ts";
import type { StoryCodeWriter } from "../frame/renderer.ts";
import { type LoadedPreview, readStory } from "../frame/storyModule.ts";
import type { ArgValue } from "../messages.ts";
import type { NamedValues } from "../namedValues.ts";
import { storyCodeText } from "../storyCodeText.ts";
import type { StoryLocation } from "../storyTree.ts";
import type { StoryDocument } from "./agent.types.ts";

/** What a story's code is written from on the server. */
export type AgentCodeParts = {
  /** The story file's code, as its `?forgebook-code` module answers, or why it could not be loaded. */
  readonly code: { readonly value: unknown } | { readonly error: string };
  /** The framework's code writer; none when it does not load on the server. */
  readonly writer: StoryCodeWriter | undefined;
  /** The source's named values, as the frame writes them by name. */
  readonly namedValues: NamedValues | undefined;
};

/** Whether a module's answer is a story file's code, by export name. */
const isStoryFileCode = (value: unknown): value is StoryFileCode =>
  typeof value === "object" && value !== null && !Array.isArray(value) && !("error" in value);

/** The story the code is of, as the story's answer read it. */
export type AgentCodeStory = {
  /** The story's place in the tree, for its export and its component's name. */
  readonly location: StoryLocation;
  /** The story file's module, as the dev server loaded it. */
  readonly module: unknown;
  /** The catalogue's previews merged, whose args are under every story's. */
  readonly preview: LoadedPreview | undefined;
  /** The values an agent set, by name; none sets nothing. */
  readonly accepted: Readonly<Record<string, ArgValue>> | undefined;
  /** The component's docs, for the name code writes it by; none takes the tree's. */
  readonly docs: ComponentDocs | undefined;
};

/**
 * A story's code; none when its module, its file's code or the framework's writer cannot be read.
 *
 * @param parts - the file's code, the framework's writer and the named values.
 * @param story - the story, its module, what an agent set and its component's docs.
 */
export const agentStoryCode = (
  parts: AgentCodeParts,
  { location, module, preview, accepted = {}, docs }: AgentCodeStory
): string | undefined => {
  const loaded = readStory(module, location.story.exportName, preview);
  const value = "value" in parts.code ? parts.code.value : undefined;
  if (typeof loaded === "string" || !isStoryFileCode(value) || parts.writer === undefined) return undefined;
  return storyCodeText(
    {
      code: value,
      exportName: location.story.exportName,
      componentName: docs === undefined ? location.component.name : codeNameOf(docs),
      args: { ...panelArgsOf(loaded.args, parts.namedValues), ...accepted },
      edited: Object.keys(accepted)
    },
    parts.writer
  );
};

/**
 * A story's answer with its code, when it can be written.
 *
 * @param document - the story's answer.
 * @param parts - the file's code, the framework's writer and the named values; none leaves the answer as it is.
 * @param story - the story, its module and the preview.
 */
export const withStoryCode = (
  document: StoryDocument,
  parts: AgentCodeParts | undefined,
  story: Pick<AgentCodeStory, "location" | "module" | "preview">
): StoryDocument => {
  const code =
    parts === undefined
      ? undefined
      : agentStoryCode(parts, { ...story, accepted: document.setArgs?.accepted, docs: document.docs });
  return code === undefined ? document : { ...document, code };
};
