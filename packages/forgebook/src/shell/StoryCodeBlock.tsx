/**
 * A story's code, as the panel's Code tab and the component page show it: its `render` as written, coloured by the
 * plugin, or, for a story drawn from its args, the component in the framework's code with the args its file writes as
 * code (functions, elements) as written and the values of the moment for the rest.
 *
 * @see `../storyCodeText.ts` for the text.
 *
 * @module
 */
import type { ReactNode } from "react";

import { renderCodeOf, type StoryCodeSource, storyCodeText, writtenArgsOf } from "../storyCodeText.ts";
import { Code } from "./Code.tsx";
import { useCodeWriter } from "./codeWriter.ts";

/**
 * Whether the story has a `render` of its own, shown as written.
 *
 * @param source - the file's code and the story.
 */
export const hasRenderCode = (source: StoryCodeSource): boolean => renderCodeOf(source) !== undefined;

/**
 * The story's code, coloured.
 *
 * @param props - the file's code, the story, the component's name and the args.
 */
export const StoryCodeBlock = (source: StoryCodeSource): ReactNode => {
  const write = useCodeWriter();
  const render = renderCodeOf(source);
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
  const names = [...Object.keys(source.args), ...Object.keys(writtenArgsOf(source))];
  return (
    <pre className="forgebook-code-block">
      <Code text={storyCodeText(source, write)} names={names} />
    </pre>
  );
};
