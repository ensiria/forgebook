/**
 * A story's code as text, as the shell shows and copies it and as `forgebook story` gives it to an agent: its `render`
 * as written, or, for a story drawn from its args, the component in the framework's code with the args its file writes
 * as code (functions, elements) as written and the values of the moment for the rest.
 *
 * @remarks
 * An arg the panel or an agent set is written from its value, not from the file's text, which no longer says what the
 * story draws. Pure: the shell and the dev server read the same text.
 *
 * @module
 */
import type { StoryCode, StoryFileCode } from "@forgebook/story-format/source";

import type { StoryCodeWriter } from "./frame/renderer.ts";
import type { PanelArgs } from "./messages.ts";

/** Which story's code, and the values its code is drawn from when it has no `render`. */
export type StoryCodeSource = {
  /** The story file's code. */
  readonly code: StoryFileCode;
  /** The story's export name. */
  readonly exportName: string;
  /** The component's name as code writes it (`codeNameOf`), for the code of a story drawn from its args. */
  readonly componentName: string;
  /** The values of the moment: the story's args, with the panel's over them on the story page. */
  readonly args: PanelArgs;
  /** The args the panel or an agent set, written from their values; none by default. */
  readonly edited?: readonly string[];
};

/**
 * The story's render as written, when it has one.
 *
 * @param source - the file's code and the story.
 */
export const renderCodeOf = ({ code, exportName }: StoryCodeSource): StoryCode | undefined => {
  const entry = code[exportName];
  return entry !== undefined && "text" in entry ? entry : undefined;
};

/**
 * The args the story's file writes as code, but those the panel or an agent set.
 *
 * @param source - the file's code, the story and what was set.
 */
export const writtenArgsOf = ({
  code,
  exportName,
  edited = []
}: StoryCodeSource): Readonly<Record<string, string>> => {
  const entry = code[exportName];
  if (entry === undefined || !("args" in entry)) return {};
  return Object.fromEntries(Object.entries(entry.args).filter(([name]) => !edited.includes(name)));
};

/**
 * The story's code as text, as copied.
 *
 * @param source - the file's code, the story, the component's name and the args.
 * @param write - the framework's code writer, for a story drawn from its args.
 */
export const storyCodeText = (source: StoryCodeSource, write: StoryCodeWriter): string =>
  renderCodeOf(source)?.text ?? write(source.componentName, source.args, writtenArgsOf(source));
