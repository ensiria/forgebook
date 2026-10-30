/**
 * A TSDoc or Markdown sentence with its code spans shown as code: what is between backticks (as `href` is written in
 * a TSDoc) is set in the code face, the rest stays text.
 *
 * @module
 */
import type { ReactNode } from "react";

/**
 * A sentence, its backtick spans as code.
 *
 * @param props - the sentence.
 */
export const CodeText = ({ text }: { readonly text: string }): ReactNode =>
  // a split on the backticks alternates text and code: the odd pieces were between backticks
  text.split("`").map((piece, index) =>
    index % 2 === 1 ? (
      // the pieces of one sentence never reorder, so their position is a stable key
      // biome-ignore lint/suspicious/noArrayIndexKey: see above
      <code key={index} className="forgebook-inline-code">
        {piece}
      </code>
    ) : (
      piece
    )
  );
