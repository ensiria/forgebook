/**
 * The table's new version put up for review: a commit with the page and its report on the `compat/table` branch, made
 * through GitHub's API so GitHub signs it, and a pull request into develop opened when none is. Nothing reaches
 * develop without a person merging it, and nothing is force-pushed: a new commit goes on top of the branch.
 *
 * @module
 */

/** The branch the table's pull request comes from. */
export const TABLE_BRANCH = "compat/table";

/** The commit's subject, a conventional commit the repository's check accepts. */
export const COMMIT_MESSAGE = "docs(compat): update the compatibility table";

/** A file to put on the branch: its path from the root and its content. */
export type TableFile = {
  /** Its path from the repository's root, with forward slashes. */
  readonly path: string;
  /** Its whole text. */
  readonly content: string;
};

/** Who to ask and with what: the repository (`owner/name`), a token that may write contents and pull requests. */
export type GitHubAccess = {
  /** `owner/name`. */
  readonly repository: string;
  /** A token that may write contents and pull requests. */
  readonly token: string;
  /** The branch the pull request goes to. */
  readonly base: string;
  /** How requests are made: the global `fetch`, or a recorded GitHub in tests. */
  readonly fetch: typeof fetch;
};

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A string field of an API answer. */
const field = (value: unknown, path: readonly string[]): string => {
  let current = value;
  for (const key of path) current = isRecord(current) ? current[key] : undefined;
  if (typeof current !== "string") throw new Error(`GitHub's answer has no ${path.join(".")}`);
  return current;
};

/** A pull request's number, from GitHub's answer. */
const pullNumber = (value: unknown): number => {
  const number = isRecord(value) ? value["number"] : undefined;
  if (typeof number !== "number") throw new Error("GitHub's answer has no pull request number");
  return number;
};

/** One call of GitHub's REST API; `undefined` for a 404 when `isMissingOk`. */
const call = async (
  access: GitHubAccess,
  method: string,
  path: string,
  body?: unknown,
  isMissingOk = false
): Promise<unknown> => {
  const response = await access.fetch(`https://api.github.com/repos/${access.repository}${path}`, {
    method,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${access.token}`,
      "x-github-api-version": "2022-11-28",
      ...(body === undefined ? {} : { "content-type": "application/json" })
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  if (response.status === 404 && isMissingOk) return undefined;
  if (!response.ok)
    throw new Error(`GitHub answered ${response.status} to ${method} ${path}: ${await response.text()}`);
  // a deletion answers 204, with no body to read
  return response.status === 204 ? undefined : response.json();
};

/** A file's text on a branch, or `undefined` when it has none. */
export const fileOnBranch = async (
  access: GitHubAccess,
  path: string,
  branch: string
): Promise<string | undefined> => {
  const answer = await call(
    access,
    "GET",
    `/contents/${path}?ref=${encodeURIComponent(branch)}`,
    undefined,
    true
  );
  if (answer === undefined) return undefined;
  return Buffer.from(field(answer, ["content"]), "base64").toString("utf8");
};

/**
 * Commits the files on the table's branch and opens its pull request, or updates both. With a pull request open, the
 * commit goes on top of its branch and its description is replaced; with none, the branch starts again from the base,
 * so a branch left by a merged or closed pull request brings none of its old commits. A commit that would change
 * nothing is not made. Resolves to the pull request's address.
 */
export const publishTable = async (
  access: GitHubAccess,
  files: readonly TableFile[],
  body: string
): Promise<string> => {
  const owner = access.repository.split("/")[0] ?? "";
  const open = await call(
    access,
    "GET",
    `/pulls?state=open&base=${encodeURIComponent(access.base)}&head=${encodeURIComponent(`${owner}:${TABLE_BRANCH}`)}`
  );
  const [existing] = Array.isArray(open) ? open : [];
  const branchRef = await call(access, "GET", `/git/ref/heads/${TABLE_BRANCH}`, undefined, true);
  if (existing === undefined && branchRef !== undefined)
    await call(access, "DELETE", `/git/refs/heads/${TABLE_BRANCH}`);
  const isOnBranch = existing !== undefined && branchRef !== undefined;
  const parent = isOnBranch
    ? field(branchRef, ["object", "sha"])
    : field(await call(access, "GET", `/git/ref/heads/${access.base}`), ["object", "sha"]);
  const parentTree = field(await call(access, "GET", `/git/commits/${parent}`), ["tree", "sha"]);
  const tree = field(
    await call(access, "POST", "/git/trees", {
      base_tree: parentTree,
      tree: files.map((file) => ({ path: file.path, mode: "100644", type: "blob", content: file.content }))
    }),
    ["sha"]
  );
  if (tree !== parentTree) {
    const commit = field(
      await call(access, "POST", "/git/commits", { message: COMMIT_MESSAGE, tree, parents: [parent] }),
      ["sha"]
    );
    if (isOnBranch)
      await call(access, "PATCH", `/git/refs/heads/${TABLE_BRANCH}`, { sha: commit, force: false });
    else await call(access, "POST", "/git/refs", { ref: `refs/heads/${TABLE_BRANCH}`, sha: commit });
  }

  if (existing !== undefined) {
    await call(access, "PATCH", `/pulls/${pullNumber(existing)}`, { body });
    return field(existing, ["html_url"]);
  }
  const created = await call(access, "POST", "/pulls", {
    title: COMMIT_MESSAGE,
    head: TABLE_BRANCH,
    base: access.base,
    body
  });
  return field(created, ["html_url"]);
};
