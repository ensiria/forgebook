/**
 * The panel's Code tab: the story's `render` as written in its file, or, for a story drawn from its args, the
 * component's JSX with the args its file writes as code and the values of the moment (the story's and the Props
 * tab's), with a button that copies it.
 *
 * @module
 */

import type { ReactNode } from "react";

import { type StoryCodeSource, storyCodeText } from "../storyCodeText.ts";
import { useCodeWriter } from "./codeWriter.ts";
import { LATER_STRINGS } from "./laterStrings.ts";
import { hasRenderCode, StoryCodeBlock } from "./StoryCodeBlock.tsx";
import { STRINGS } from "./strings.ts";
import { useCopy } from "./useCopy.ts";

/** The tab's props: the story whose code it shows. */
export type CodeTabProps = StoryCodeSource;

/**
 * The Code tab.
 *
 * @param props - the file's code, the story, the component's name and the args.
 */
export const CodeTab = (props: CodeTabProps): ReactNode => {
  const { isCopied, copy } = useCopy();
  const write = useCodeWriter();
  const hasRender = hasRenderCode(props);
  return (
    <div className="forgebook-prop-group">
      <div className="forgebook-calls__head">
        <h3 className="forgebook-prop-group__title">
          {hasRender ? LATER_STRINGS.codeRender : LATER_STRINGS.codeFromArgs}
        </h3>
        <button
          type="button"
          className="forgebook-text-button"
          onClick={(): void => copy(storyCodeText(props, write))}
          aria-live="polite"
        >
          {isCopied ? STRINGS.copied : LATER_STRINGS.copy}
        </button>
      </div>
      <StoryCodeBlock {...props} />
    </div>
  );
};
