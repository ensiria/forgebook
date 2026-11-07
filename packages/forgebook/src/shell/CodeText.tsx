/**
 * A TSDoc or Markdown sentence with its code spans shown as code: what is between backticks (as `href` is written in
 * a TSDoc) is set in the code face, the rest stays text. Spans are read as CommonMark reads them (`codeSpans.ts`).
 *
 * @module
 */
import type { ReactNode } from "react";

import { sentencePieces } from "./codeSpans.ts";

/**
 * A sentence, its backtick spans as code.
 *
 * @param props - the sentence.
 */
export const CodeText = ({ text }: { readonly text: string }): ReactNode =>
  sentencePieces(text).map((piece, index) =>
    piece.isCode ? (
      // the pieces of one sentence never reorder, so their position is a stable key
      // biome-ignore lint/suspicious/noArrayIndexKey: see above
      <code key={index} className="forgebook-inline-code">
        {piece.text}
      </code>
    ) : (
      piece.text
    )
  );
