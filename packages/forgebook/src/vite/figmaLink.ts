/**
 * A design's link, as a story's `parameters.design.figma` writes it: read and checked once, by the index, then trusted
 * by the shell, the tools and the catalogue's docs alike.
 *
 * @remarks
 * A link is anything a story file writes, and the Design tab frames it, so it is taken apart rather than passed on:
 * only `https` on Figma's own hosts is accepted, and the embed's address is built from the parts read here
 * (`@forgebook/plugin-figma`). Figma's embed takes the kinds in `FILE_KINDS` only. Checking a story's link while
 * indexing keeps the checker out of the shell's and the frame's first load: they read the index's link as it is. A docs
 * page's `figma` fence is checked in the page, by the plugin's block, which loads only where a page draws one; this
 * module imports nothing of Node for that reason (`forgebook/figma-link`).
 *
 * @module
 */
import type { FigmaFileKind, FigmaLink } from "@forgebook/story-format/source";

/** The hosts a design's link may name; `embed.figma.com` is what a link copied from an embed code names. */
const FIGMA_HOSTS: ReadonlySet<string> = new Set(["figma.com", "www.figma.com", "embed.figma.com"]);

/** The file kinds by the first segment of a link's path; `file` is the older name of `design`. */
const FILE_KINDS: ReadonlyMap<string, FigmaFileKind> = new Map([
  ["design", "design"],
  ["file", "design"],
  ["proto", "proto"],
  ["board", "board"],
  ["slides", "slides"],
  ["deck", "deck"]
]);

/** A file's or a branch's key, as Figma writes them. */
const KEY = /^[A-Za-z0-9]+$/;

/** A node's id, in a link (`12-34`, `I12-34;56-78`) or in Figma's REST API (`12:34`). */
const NODE_ID = /^[A-Za-z]?\d+[-:]\d+(;\d+[-:]\d+)*$/;

/** The most of a refused link a message repeats. */
const MAX_QUOTED = 120;

/**
 * A refused link as a message shows it: on one line, shortened, since the message reaches terminals and agents.
 *
 * @param text - the link, as a story writes it.
 */
const quoted = (text: string): string => JSON.stringify(text.slice(0, MAX_QUOTED));

/**
 * The node a link's `node-id` names, or why it cannot be one.
 *
 * @param url - the link.
 * @returns the node as a link writes it; `undefined` when the link names none; an `Error` when it is malformed.
 */
const nodeIdOf = (url: URL): string | undefined | Error => {
  const [written, ...others] = url.searchParams.getAll("node-id");
  if (written === undefined) return undefined;
  return NODE_ID.test(written) && others.length === 0
    ? written
    : new Error("its `node-id` is not one Figma node");
};

/**
 * The key of the branch a link's path names, or why it cannot be one.
 *
 * @param third - the path's third segment.
 * @param branchKey - the path's fourth segment.
 * @returns the key; `undefined` for a link to no branch; an `Error` when the key is malformed, since the design shown
 * would be the main file's and not the one linked to.
 */
const branchKeyOf = (third: string | undefined, branchKey: string): string | undefined | Error => {
  if (third !== "branch") return undefined;
  return KEY.test(branchKey) ? branchKey : new Error("its branch is not a Figma key");
};

/**
 * Reads a design's link.
 *
 * @remarks
 * The link kept is rebuilt from the parts checked: the rest of what a story wrote (a tracking parameter, a path past the
 * file's name, a fragment) would otherwise reach the page, the agents and `CATALOG.md` unchecked.
 *
 * @param text - the link, as a story writes it.
 * @returns the link, or a message saying why it is not one.
 */
export const figmaLink = (text: string): FigmaLink | string => {
  if (!URL.canParse(text)) return `${quoted(text)} is not an address`;
  const url = new URL(text);
  // a user name or a port would make the address read as Figma's while it could reach something else
  const isFigma =
    url.protocol === "https:" &&
    FIGMA_HOSTS.has(url.hostname) &&
    url.port === "" &&
    url.username === "" &&
    url.password === "";
  if (!isFigma) return `${quoted(text)} is not a link to figma.com`;
  const [first = "", fileKey = "", third, fourth = ""] = url.pathname.split("/").slice(1);
  const kind = FILE_KINDS.get(first);
  if (kind === undefined || !KEY.test(fileKey)) return `${quoted(text)} is not a link to a Figma file`;
  const branchKey = branchKeyOf(third, fourth);
  if (branchKey instanceof Error) return `${quoted(text)}: ${branchKey.message}`;
  const node = nodeIdOf(url);
  if (node instanceof Error) return `${quoted(text)}: ${node.message}`;
  const branch = branchKey === undefined ? "" : `/branch/${branchKey}`;
  const query = node === undefined ? "" : `?${new URLSearchParams({ "node-id": node }).toString()}`;
  return {
    url: `https://www.figma.com/${kind}/${fileKey}${branch}${query}`,
    kind,
    fileKey,
    ...(branchKey === undefined ? {} : { branchKey }),
    ...(node === undefined ? {} : { nodeId: node.replaceAll("-", ":") })
  };
};
