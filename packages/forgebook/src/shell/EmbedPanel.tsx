/**
 * What the Embed button opens: the story's link, for a wiki or Notion, and its HTML, for a page of one's own, each with
 * a button that copies it. Loaded the first time it opens.
 *
 * @module
 */
import "./embed.scss";

import { type ChangeEvent, type FocusEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";

import { embedAddressOf, embedCode, isLocalAddress } from "../embedCode.ts";
import { STRINGS } from "./strings.ts";
import { useCopy } from "./useCopy.ts";

/** What the panel shows. */
export type EmbedPanelProps = {
  /** The story's id. */
  readonly storyId: string;
  /** The iframe's accessible title. */
  readonly title: string;
  /** The view and the args to embed the story in, as the address's query. */
  readonly query: string;
  /** The story's height now, in CSS px: what the iframe starts at. */
  readonly height: number;
};

/**
 * One text to copy: its label, the text in a field that selects it when focused, and the button.
 *
 * @param props - the label, the text, and whether the panel's focus starts here.
 */
const EmbedField = ({
  label,
  value,
  isFirst
}: {
  readonly label: string;
  readonly value: string;
  readonly isFirst?: boolean;
}): ReactNode => {
  const { isCopied, hasFailed, copy } = useCopy();
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  // the panel loads after the popover opens, so the popover's own focus finds nothing to take it
  useEffect(() => {
    if (isFirst === true) field.current?.focus();
  }, [isFirst]);
  // with no clipboard, the text selected is one key away
  useEffect(() => {
    if (hasFailed) field.current?.select();
  }, [hasFailed]);
  const buttonText = isCopied ? STRINGS.copied : STRINGS.copy;
  return (
    <div className="forgebook-embed-field">
      <label className="forgebook-embed-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        ref={field}
        id={id}
        className="forgebook-embed-field__value"
        readOnly
        value={value}
        onFocus={(event: FocusEvent<HTMLInputElement>): void => event.currentTarget.select()}
      />
      <button
        type="button"
        className="forgebook-button"
        aria-label={`${STRINGS.copy}: ${label}`}
        aria-live="polite"
        onClick={(): void => copy(value)}
      >
        {hasFailed ? STRINGS.embedCopyFailed : buttonText}
      </button>
    </div>
  );
};

/**
 * The panel.
 *
 * @param props - the story, its view and its height.
 */
export const EmbedPanel = ({ storyId, title, query, height }: EmbedPanelProps): ReactNode => {
  const [isFollowing, setIsFollowing] = useState(false);
  const page = `${window.location.origin}${window.location.pathname}`;
  const link = embedAddressOf(page, storyId, query);
  return (
    <>
      <p className="forgebook-embed-panel__hint">{STRINGS.embedHint}</p>
      <EmbedField label={STRINGS.embedLink} value={link} isFirst={true} />
      <EmbedField label={STRINGS.embedCode} value={embedCode({ link, title, height, isFollowing })} />
      <label className="forgebook-embed-panel__follow">
        <input
          type="checkbox"
          role="switch"
          aria-checked={isFollowing}
          className="forgebook-switch"
          checked={isFollowing}
          onChange={(event: ChangeEvent<HTMLInputElement>): void =>
            setIsFollowing(event.currentTarget.checked)
          }
        />
        {STRINGS.embedFollow}
      </label>
      {isFollowing ? <p className="forgebook-embed-panel__hint">{STRINGS.embedFollowHint}</p> : null}
      {isLocalAddress(link) ? (
        <p className="forgebook-embed-panel__hint" data-warning="">
          {STRINGS.embedLocal}
        </p>
      ) : null}
    </>
  );
};
