/**
 * What `forgebook proof` writes for a person: the pull request's comment and a page of pictures.
 *
 * @remarks
 * Pure. Everything here comes from the branch under review, whose author may be an agent or a stranger: a file or a story
 * can be named anything. This is what the command prints and the run's summary shows; the pull request's comment is written
 * by a job that trusts none of it (`proofWorkflow.ts`). A name only ever appears in a code span or a fenced block, where Markdown does not make a link,
 * an image or a mention of it, and in the page it is escaped. The comment's size is held under what GitHub accepts, cutting
 * whole lines and saying so. A comment that showed only what differs would read as all clear, so what was not checked
 * has a section of its own, always there.
 *
 * @module
 */
import type { ProofDocument, ProofState } from "../../src/vite/agent.types.ts";

/** What the workflow replaces with the address of the run's pictures, known only once they are uploaded. */
export const ARTIFACT_PLACEHOLDER = "__FORGEBOOK_PROOF_ARTIFACT__";

/** The longest comment written, in characters: GitHub refuses over 65,536. */
const MAX_COMMENT = 60_000;

/** What ends a comment that had to be cut. */
const CUT_ENDING = "\n\nCut here to fit a comment: the rest is in the pictures' `proof.json`.\n";

/** The most states a comment lists: the rest are in the page. */
const MAX_LISTED = 40;

/** The longest name kept in a code span. */
const MAX_NAME = 120;

/** A status in the words of a person reading a review. */
const STATUS_WORDS: Readonly<Record<ProofState["status"], string>> = {
  changed: "changed",
  resized: "changed size",
  new: "new",
  broken: "did not draw",
  removed: "removed",
  unstable: "unstable: differs between two pictures of the same code"
};

/**
 * A name as a Markdown code span, whatever it holds: no line break, a fence longer than any run of backticks in it, and
 * nothing a table reads as a new cell.
 *
 * @param text - the name.
 */
export const codeSpan = (text: string): string => {
  const flat = text.replace(/[\r\n\t|]+/g, " ").slice(0, MAX_NAME);
  const longest = Math.max(0, ...(flat.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  return `${fence} ${flat} ${fence}`;
};

/**
 * Lines as a fenced block, whatever they hold: the fence is longer than any run of backticks in them.
 *
 * @param lines - the lines.
 */
const fenced = (lines: readonly string[]): string => {
  const text = lines.join("\n");
  const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longest + 1);
  return `${fence}text\n${text}\n${fence}`;
};

/** One state as a table's row. */
const stateRow = (state: ProofState): string =>
  `| ${codeSpan(state.storyId)} | ${codeSpan(state.view || "default")} | ${STATUS_WORDS[state.status]} | ${state.percent.toFixed(2)} % |`;

/** The section listing the states the change touched. */
const statesSection = (document: ProofDocument): readonly string[] => {
  const { states, same } = document;
  if (states.length === 0) return [`No picture differs: ${same} compared and the same.`];
  const listed = states.slice(0, MAX_LISTED);
  return [
    `${states.length} differ, ${same} the same.`,
    "",
    "| Story | View | Compared with the base | Pixels |",
    "|---|---|---|---|",
    ...listed.map(stateRow),
    ...(states.length > listed.length
      ? ["", `And ${states.length - listed.length} more, in the pictures.`]
      : [])
  ];
};

/**
 * The pull request's comment.
 *
 * @param document - the proof.
 * @returns its Markdown, with `ARTIFACT_PLACEHOLDER` where the pictures' address goes.
 */
export const proofComment = (document: ProofDocument): string => {
  const text = [
    "### Forgebook proof",
    "",
    `Built in this run from ${codeSpan(document.base.slice(0, 12))} and ${codeSpan(document.head.slice(0, 12))}, with no stored picture. [Before and after pictures](${ARTIFACT_PLACEHOLDER}) (open \`index.html\` in the download).`,
    "",
    "#### States touched",
    "",
    ...statesSection(document),
    "",
    "#### Checked",
    "",
    fenced([`verdict: ${document.verdict}`, document.summary, ...document.checked]),
    "",
    "#### Not checked",
    "",
    document.notChecked.length === 0 ? "Nothing this run knows of." : fenced(document.notChecked),
    ""
  ].join("\n");
  if (text.length <= MAX_COMMENT) return text;
  const cut = text.slice(0, MAX_COMMENT);
  const whole = cut.slice(0, cut.lastIndexOf("\n"));
  const fences = whole.match(/^`{3,}/gm) ?? [];
  // an unclosed fence would swallow the ending
  return `${whole}${fences.length % 2 === 1 ? `\n${fences.at(-1) ?? "```"}` : ""}${CUT_ENDING}`;
};

/** Text as HTML. */
const escaped = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/** One picture of a state in the page, when it has it and it is one of the run's own: `pictures/…`. */
const pictureCell = (label: string, file: string | undefined): string =>
  file === undefined || !/^pictures\/[^/]+\.png$/.test(file)
    ? ""
    : `<figure><figcaption>${label}</figcaption><a href="${escaped(file)}"><img loading="lazy" alt="${label}" src="${escaped(file)}"></a></figure>`;

/** One state in the page. */
const stateBlock = (state: ProofState): string =>
  [
    `<section><h2>${escaped(state.storyId)} <small>${escaped(state.view || "default")}: ${STATUS_WORDS[state.status]}, ${state.percent.toFixed(2)} %</small></h2><div>`,
    pictureCell("Before", state.pictures.before),
    pictureCell("After", state.pictures.after),
    pictureCell("Marked", state.pictures.marked),
    "</div></section>"
  ].join("");

/**
 * The page a reviewer opens from the run's pictures: every state side by side, what was not checked above them.
 *
 * @param document - the proof.
 */
export const proofPage = (document: ProofDocument): string =>
  [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Forgebook proof</title>',
    // no script runs here, whatever a branch's run wrote in the names of its files
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'">`,
    '<meta name="viewport" content="width=device-width">',
    "<style>:root{color-scheme:light dark;font:14px system-ui}section div{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;max-width:32%;min-width:240px}img{max-width:100%;border:1px solid #8888}small{font-weight:400}</style>",
    `</head><body><h1>Forgebook proof</h1><p>${escaped(document.base.slice(0, 12))} to ${escaped(document.head.slice(0, 12))}: ${escaped(document.summary)}</p>`,
    "<h2>Not checked</h2><ul>",
    ...document.notChecked.map((each) => `<li>${escaped(each)}</li>`),
    "</ul>",
    ...document.states.map(stateBlock),
    `<p>${document.same} more compared and the same.</p></body></html>\n`
  ].join("");
