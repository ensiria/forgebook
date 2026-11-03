/**
 * A story's code, as the panel's Code tab and the component page show it: its `render` as written, coloured by the
 * plugin, or, for a story drawn from its args, the component in the framework's code with the values of the moment.
 *
 * @module
 */
import type { StoryFileCode } from "@forgebook/story-format/source";
import type { ReactNode } from "react";

import type { StoryCodeWriter } from "../frame/renderer.ts";
import type { PanelArgs } from "../messages.ts";
import { Code } from "./Code.tsx";
import { useCodeWriter } from "./codeWriter.ts";

/** Which story's code, and the values its JSX is drawn from when it has no `render`. */
export type StoryCodeSource = {
  /** The story file's code. */
  readonly code: StoryFileCode;
  /** The story's export name. */
  readonly exportName: string;
  /** The component's name as code writes it (`codeNameOf`), for the code of a story drawn from its args. */
  readonly componentName: string;
  /** The values of the moment: the story's args, with the panel's over them on the story page. */
  readonly args: PanelArgs;
};

/**
 * The story's code as text, as copied.
 *
 * @param source - the file's code, the story, the component's name and the args.
 * @param write - the framework's code writer, for a story drawn from its args.
 */
export const storyCodeText = (
  { code, exportName, componentName, args }: StoryCodeSource,
  write: StoryCodeWriter
): string => code[exportName]?.text ?? write(componentName, args);

/**
 * The story's code, coloured.
 *
 * @param props - the file's code, the story, the component's name and the args.
 */
export const StoryCodeBlock = (source: StoryCodeSource): ReactNode => {
  const write = useCodeWriter();
  const render = source.code[source.exportName];
  if (render !== undefined) {
    // biome-ignore lint/style/useNamingConvention: React's own name for markup set as HTML
    const markup = { __html: render.html };
    return (
      <pre className="forgebook-code-block">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the plugin's HTML of the story file's own text, or the same kept in the project's own node_modules/.vite, as trusted as the story's code */}
        <code className="forgebook-code" dangerouslySetInnerHTML={markup} />
      </pre>
    );
  }
  // the attributes' names are names, not types: only the component's name is coloured as one
  return (
    <pre className="forgebook-code-block">
      <Code text={storyCodeText(source, write)} names={Object.keys(source.args)} />
    </pre>
  );
};
