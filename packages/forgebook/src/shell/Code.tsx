/**
 * Coloured code: an event's signature and calls in the props panel, a story's code in the Code card.
 *
 * @module
 */
import type { ReactNode } from "react";

import { codeTokens } from "./codeTokens.ts";

/**
 * Coloured code.
 *
 * @param props - the text, and the names coloured as names (the event's parameters).
 */
export const Code = ({
  text,
  names
}: {
  readonly text: string;
  readonly names: readonly string[];
}): ReactNode => (
  <code className="forgebook-code">
    {codeTokens(text, new Set(names)).map((token, index) => (
      // the tokens of one text never reorder, so their position is a stable key
      // biome-ignore lint/suspicious/noArrayIndexKey: see above
      <span key={index} className={`forgebook-code__${token.kind}`}>
        {token.text}
      </span>
    ))}
  </code>
);
