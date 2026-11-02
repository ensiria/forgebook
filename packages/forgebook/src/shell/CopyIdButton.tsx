/**
 * The stage's button that copies a story's id, for an agent or a test.
 *
 * @module
 */
import type { ReactNode } from "react";

import { Icon } from "./icons.tsx";
import { STRINGS } from "./strings.ts";
import { useCopy } from "./useCopy.ts";

/**
 * Copies the story's id (`kit:inputs-selection-select--overview`), the name tests and tools address it by; the id
 * shows as the button's tooltip.
 *
 * @param props - the story's id.
 */
export const CopyIdButton = ({ storyId }: { readonly storyId: string }): ReactNode => {
  const { isCopied, copy } = useCopy();
  return (
    <button
      type="button"
      className="forgebook-button forgebook-button--icon"
      title={`${STRINGS.copyStoryId}: ${storyId}`}
      aria-label={isCopied ? STRINGS.copied : STRINGS.copyStoryId}
      onClick={(): void => copy(storyId)}
    >
      <Icon name={isCopied ? "check" : "hash"} size={14} />
    </button>
  );
};
