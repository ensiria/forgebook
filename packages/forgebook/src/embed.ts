/**
 * How an address asks for a story alone, for a page of someone else's (a wiki, Notion, a design doc), and what that
 * story tells the page around it.
 *
 * @remarks
 * Pure and small, since the shell's first screen reads it to decide what to mount. The catalogue's page itself is the
 * embed: `?embed` turns it into one story without the sidebar, the toolbar or the panel, so the theme, the fonts and the
 * catalogue's own style sheet are there with no second page to keep in step, and a docs page can join as another kind
 * of target.
 *
 * @module
 */

/** The address's parameter that asks for the story alone. */
export const EMBED_PARAMETER = "embed";

/** The message's type, as a page that embeds a story listens for it. */
export const EMBED_SIZE_TYPE = "forgebook:embed-size";

/**
 * What an embed posts to the page around it each time the story's height settles. It holds nothing but the height, so
 * it can go to any origin: an embed cannot know who frames it.
 */
export type EmbedSizeMessage = {
  /** The message's type. */
  readonly type: typeof EMBED_SIZE_TYPE;
  /** The story's height, in CSS px. */
  readonly height: number;
};

/** The parameter's values that say no, so a template can write `embed=false` and get the whole catalogue. */
const OFF_VALUES: readonly (string | null)[] = [null, "0", "false"];

/**
 * Whether an address asks for the story alone: `embed` with no value, or any but `0` and `false`.
 *
 * @param search - the address's query, with or without `?`.
 */
export const isEmbedAddress = (search: string): boolean =>
  !OFF_VALUES.includes(new URLSearchParams(search).get(EMBED_PARAMETER));
