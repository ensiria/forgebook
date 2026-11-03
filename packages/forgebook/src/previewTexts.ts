/**
 * The words of a story's preview in a client that renders apps. A catalogue replaces any of them by name
 * (`strings: { previewOpen: "Open" }` in its configuration), as it does the shell's; they stay out of the shell's texts,
 * whose page never shows them.
 *
 * @module
 */

/** The page's words, as Forgebook writes them. */
export const PREVIEW_TEXTS = {
  previewWaiting: "Waiting for the story",
  previewLoading: "Loading the story",
  previewTakingPicture: "This client cannot show the story live: taking its picture",
  previewUnavailable: "This client can show neither the story nor its picture. Open it in the catalogue.",
  previewCancelled: "The preview was cancelled",
  previewOpen: "Open in the catalogue",
  previewPicture: "A picture of the story",
  previewFrame: "The story"
};

/** The page's words. */
export type PreviewTexts = typeof PREVIEW_TEXTS;

/**
 * The words of a catalogue: its replacements over Forgebook's. A replacement of no word of the page is left out.
 *
 * @param strings - the catalogue's `strings`.
 */
export const previewTexts = (strings: Readonly<Record<string, string>>): PreviewTexts => ({
  previewWaiting: strings["previewWaiting"] ?? PREVIEW_TEXTS.previewWaiting,
  previewLoading: strings["previewLoading"] ?? PREVIEW_TEXTS.previewLoading,
  previewTakingPicture: strings["previewTakingPicture"] ?? PREVIEW_TEXTS.previewTakingPicture,
  previewUnavailable: strings["previewUnavailable"] ?? PREVIEW_TEXTS.previewUnavailable,
  previewCancelled: strings["previewCancelled"] ?? PREVIEW_TEXTS.previewCancelled,
  previewOpen: strings["previewOpen"] ?? PREVIEW_TEXTS.previewOpen,
  previewPicture: strings["previewPicture"] ?? PREVIEW_TEXTS.previewPicture,
  previewFrame: strings["previewFrame"] ?? PREVIEW_TEXTS.previewFrame
});
