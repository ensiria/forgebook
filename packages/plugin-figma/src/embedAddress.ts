/**
 * The address that frames a design from Figma, made only from a checked link's parts, on a host written here.
 *
 * @see {@link https://developers.figma.com/docs/embeds/embed-figma-file/ | Embedding a Figma file}
 *
 * @module
 */
import type { FigmaLink } from "forgebook/figma-link";

/** The host Figma's embeds are served from. */
const EMBED_HOST = "embed.figma.com";

/** How the embed names the product showing it: Figma answers an embed without it with an error. */
const EMBED_PRODUCT = "forgebook";

/**
 * The address that embeds a design, needing no token: the reader's own Figma session, or the file's sharing, decides
 * what it shows.
 *
 * @param link - the design's link.
 * @param isDark - whether Figma's interface around the design is dark.
 */
export const figmaEmbedAddress = (link: FigmaLink, isDark: boolean): string => {
  const params = new URLSearchParams({ "embed-host": EMBED_PRODUCT, theme: isDark ? "dark" : "light" });
  if (link.nodeId !== undefined) params.set("node-id", link.nodeId);
  const branch = link.branchKey === undefined ? "" : `/branch/${link.branchKey}`;
  return `https://${EMBED_HOST}/${link.kind}/${link.fileKey}${branch}?${params.toString()}`;
};
