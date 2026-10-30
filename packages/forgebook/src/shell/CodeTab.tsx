/**
 * The panel's Code tab: the story's `render` as written in its file, or, for a story drawn from its args, the
 * component's JSX with the values of the moment (the story's and the Props tab's), with a button that copies it.
 *
 * @module
 */

import type { ReactNode } from "react";

import { useCodeWriter } from "./codeWriter";
import { StoryCodeBlock, type StoryCodeSource, storyCodeText } from "./StoryCodeBlock";
import { STRINGS } from "./strings";
import { useCopy } from "./useCopy";

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
  const hasRender = props.code[props.exportName] !== undefined;
  return (
    <div className="forgebook-prop-group">
      <div className="forgebook-calls__head">
        <h3 className="forgebook-prop-group__title">
          {hasRender ? STRINGS.codeRender : STRINGS.codeFromArgs}
        </h3>
        <button
          type="button"
          className="forgebook-text-button"
          onClick={(): void => copy(storyCodeText(props, write))}
          aria-live="polite"
        >
          {isCopied ? STRINGS.copied : STRINGS.copy}
        </button>
      </div>
      <StoryCodeBlock {...props} />
    </div>
  );
};
