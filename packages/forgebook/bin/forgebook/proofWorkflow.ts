/**
 * The GitHub workflow `forgebook proof --write-workflow` writes: the comparison in one job, the comment in another.
 *
 * @remarks
 * The job that runs the branch's code holds no write token, and its checkout keeps no credential, so code under review
 * has nothing to write with. It can still write what it likes in its result, so the job that posts, which runs nothing of
 * the branch, trusts no text of it: it writes the comment itself from `proof.json`, every name in a code span or a fenced
 * block with its backticks taken out, so nothing there is a mention, a link or an image, and it asks GitHub itself which
 * files the pull request edits. `pull_request_target`, which would give a fork's code a write token, is never used. A
 * fork's run has a read-only token, so the posting step cannot post: the proof stays in the run's summary and artefact.
 *
 * @module
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Where the workflow is written, from the repository's folder. */
export const WORKFLOW_FILE = ".github/workflows/forgebook-proof.yml";

/** Which of a pull request's files shape the run, as grep reads it; `proofRun.ts` holds the same for what it says itself. */
const MAKES_THE_PROOF_TEXT: string = String.raw`^(\.github/|patches/)|(^|/)(forgebook\.(config|preview)\.[^/]+|vite\.config\.[^/]+|package\.json|package-lock\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|yarn\.lock|bun\.lock|\.npmrc|\.yarnrc\.yml|\.pnpmfile\.c?js)$`;

/** What finds the comment again, so a new push replaces it. */
export const COMMENT_MARKER = "<!-- forgebook-proof -->";

/** Actions by the commit they are pinned to: a tag can be moved under a workflow that holds a token. */
const CHECKOUT = "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1";
const SETUP_NODE = "actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0";
const UPLOAD = "actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2";
/** The action that fetches the proof in the posting job. */
export const DOWNLOAD = "actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2";
const SETUP_PNPM = "pnpm/action-setup@73e46992e05b19abd31f2f3c20e0e7370d762115 # v6.1.1";
const SETUP_BUN = "oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0";

/** A package manager, by the lockfile that names it, and how it installs exactly what is locked. */
const MANAGERS: readonly {
  readonly lockfile: string;
  readonly install: string;
  readonly setup: readonly string[];
  readonly run: string;
}[] = [
  {
    lockfile: "pnpm-lock.yaml",
    install: "pnpm install --frozen-lockfile",
    setup: [`      - uses: ${SETUP_PNPM}`],
    run: "pnpm exec"
  },
  {
    lockfile: "yarn.lock",
    install: "yarn install --immutable",
    setup: ["      - run: corepack enable"],
    run: "yarn exec"
  },
  {
    lockfile: "bun.lock",
    install: "bun install --frozen-lockfile",
    setup: [`      - uses: ${SETUP_BUN}`],
    run: "bunx"
  },
  { lockfile: "package-lock.json", install: "npm ci", setup: [], run: "npx" }
];

/**
 * The command that installs what a checkout locks; none when no lockfile says.
 *
 * @param root - the checkout's folder.
 */
export const installCommandOf = (root: string): string | undefined =>
  MANAGERS.find(({ lockfile }) => existsSync(join(root, lockfile)))?.install;

/**
 * The comment, written from the proof by a job that trusts none of it, as jq reads it: `$files` are the edits GitHub names,
 * `$run` the run's address, `$pictures` the pictures' address once checked. Backticks are written `\u0060` so this stays
 * one template literal.
 */
export const COMMENT_FILTER: string = String.raw`def word: tostring | gsub("[\u0060\r\n\t|]"; " ") | .[0:120];
def line: tostring | gsub("\u0060"; "'") | gsub("\r"; " ") | .[0:600];
def fence($lines): "\u0060\u0060\u0060text\n" + ($lines | map(line) | join("\n")) + "\n\u0060\u0060\u0060";
def row: "| \u0060 " + (.storyId | word) + " \u0060 | \u0060 " + ((if .view == "" then "default" else .view end) | word) + " \u0060 | "
  + (if (.status | IN("changed","resized","new","broken","removed","unstable")) then .status else "unknown" end)
  + " | " + ((.percent | tonumber? // 0) * 100 | round / 100 | tostring) + " % |";
[
  "### Forgebook proof",
  "",
  "Made by this branch's own run, so a hostile branch could forge what follows. Files it edits that shape the run, as GitHub lists them:",
  "",
  (if ($files | length) == 0 then "None." else fence($files[:100]) end),
  "",
  (if $pictures == "" then "[The run](" + $run + ")" else "[Before and after pictures](" + $pictures + "): open index.html in the download." end),
  "",
  "#### States touched",
  "",
  ((.states | length | tostring) + " differ, " + (.same | tonumber? // 0 | tostring) + " the same."),
  "",
  (if (.states | length) == 0 then "" else "| Story | View | Compared with the base | Pixels |\n|---|---|---|---|\n" + (.states[:40] | map(row) | join("\n")) end),
  "",
  "#### Checked",
  "",
  fence(["verdict: " + (.verdict | tostring), .summary] + .checked),
  "",
  "#### Not checked",
  "",
  (if (.notChecked | length) == 0 then "Nothing this run knows of." else fence(.notChecked[:60]) end)
] | join("\n")`;

/** What posts the comment, as the workflow's step runs it: with no proof, it says the run did not finish. */
const POST_SCRIPT: string = String.raw`marker='${COMMENT_MARKER}'
run_url="$GITHUB_SERVER_URL/$REPOSITORY/actions/runs/$RUN"
if gh api "repos/$REPOSITORY/pulls/$PULL/files" --paginate --jq '.[].filename' > files.txt; then
  grep -E "$OWN_FILES" files.txt | jq -R . | jq -s . > own.json || echo '[]' > own.json
else
  echo '["GitHub did not list the files: read them in the pull request"]' > own.json
fi
pictures=""
artifact_id=$(basename "$ARTIFACT")
case "$ARTIFACT" in
  "$run_url/artifacts/$artifact_id")
    if [ -n "$artifact_id" ] && [ -z "$(printf '%s' "$artifact_id" | tr -d 0-9)" ]; then pictures="$ARTIFACT"; fi
    ;;
esac
if [ -s proof.json ] && text=$(jq -r --slurpfile own own.json --arg run "$run_url" --arg pictures "$pictures" "\$own[0] as \$files | $COMMENT_FILTER" proof.json); then
  body="$marker"$'\n'"$text"
else
  body="$marker"$'\n'"### Forgebook proof"$'\n\n'"This run did not finish, so nothing is proved for this commit: [read the run]($run_url)."
fi
found=$(gh api "repos/$REPOSITORY/issues/$PULL/comments" --paginate --jq ".[] | select(.user.login == \"github-actions[bot]\" and (.body | startswith(\"$marker\"))) | .id" | head -n 1)
if [ -n "$found" ]; then
  gh api --method PATCH "repos/$REPOSITORY/issues/comments/$found" -f body="$body" > /dev/null
else
  gh api --method POST "repos/$REPOSITORY/issues/$PULL/comments" -f body="$body" > /dev/null
fi`;

/** A block of text at a YAML block's indent. */
const indented = (text: string, spaces: number): string =>
  text
    .split("\n")
    .map((line) => (line === "" ? "" : `${" ".repeat(spaces)}${line}`))
    .join("\n");

/**
 * The job that posts, the same for every project.
 *
 * @param download - the action that fetches the proof, as `uses` writes it.
 */
export const commentJob = (download: string): string => `  comment:
    needs: proof
    if: \${{ !cancelled() }}
    runs-on: ubuntu-latest
    # runs nothing of the branch; a fork's token stays read-only whatever this asks
    permissions:
      pull-requests: write
    steps:
      - uses: ${download}
        continue-on-error: true
        with:
          name: forgebook-proof
      - name: Post one comment
        continue-on-error: true
        env:
          GH_TOKEN: \${{ github.token }}
          ARTIFACT: \${{ needs.proof.outputs.artifact }}
          PULL: \${{ github.event.pull_request.number }}
          REPOSITORY: \${{ github.repository }}
          RUN: \${{ github.run_id }}
          OWN_FILES: ${JSON.stringify(MAKES_THE_PROOF_TEXT)}
          COMMENT_FILTER: |
${indented(COMMENT_FILTER, 12)}
        run: |
${indented(POST_SCRIPT, 10)}
`;

/**
 * The workflow's text.
 *
 * @param root - the repository's folder, whose lockfile names the package manager.
 * @param catalogue - the catalogue's folder, relative to it; empty when it is the repository's.
 */
export const proofWorkflow = (root: string, catalogue: string): string => {
  const manager = MANAGERS.find(({ lockfile }) => existsSync(join(root, lockfile))) ?? {
    install: "npm install",
    setup: [],
    run: "npx"
  };
  const folder = catalogue === "" ? [] : [`        working-directory: ${JSON.stringify(catalogue)}`];
  return `# A picture of every state a pull request touches, against its base, drawn in this run with nothing stored.
name: forgebook proof
on:
  pull_request:

# a newer push replaces the run, so an older one cannot overwrite its comment
concurrency:
  group: forgebook-proof-\${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  proof:
    runs-on: ubuntu-latest
    # what runs here is the branch's code: no write token, and no credential left in its checkout
    permissions:
      contents: read
    outputs:
      artifact: \${{ steps.pictures.outputs.artifact-url }}
    steps:
      - uses: ${CHECKOUT}
        with:
          fetch-depth: 0
          persist-credentials: false
${[...manager.setup, ""].join("\n")}      - uses: ${SETUP_NODE}
        with:
          node-version: 24
      - run: ${manager.install}
      - run: ${manager.run} playwright install --with-deps chromium
      - name: Compare the base and this branch
${[...folder, ""].join("\n")}        run: ${manager.run} forgebook proof --base "origin/$BASE_REF" --out "$RUNNER_TEMP/forgebook-proof" --fail-on-verdict
        env:
          BASE_REF: \${{ github.base_ref }}
      - name: Keep the proof in the run's summary
        if: \${{ !cancelled() }}
        run: cat "$RUNNER_TEMP/forgebook-proof/comment.md" >> "$GITHUB_STEP_SUMMARY" || true
      - id: pictures
        if: \${{ !cancelled() }}
        uses: ${UPLOAD}
        with:
          name: forgebook-proof
          path: \${{ runner.temp }}/forgebook-proof
          if-no-files-found: ignore
          retention-days: 14

${commentJob(DOWNLOAD)}`;
};
