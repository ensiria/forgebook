/**
 * The GitHub Actions workflow `forgebook init --agents` writes: on every pull request it installs the project, its browser,
 * and runs `forgebook verify` against the branch the pull request targets.
 *
 * @remarks
 * The whole history is fetched, since `verify` compares with where the branch left its target. The target's name comes
 * through the environment and not into the script, where a branch's name could be read as shell. Its permissions are the
 * least a read needs. Pure.
 *
 * @module
 */
import type { PackageManagerName } from "../newProject/newProject.types.ts";
import { forgebookCommandLine } from "./projectRunner.ts";

/** The workflow's file, from the repository's root. */
export const WORKFLOW_FILE = ".github/workflows/forgebook-verify.yml";

/** The steps that bring a package manager, and its install with the lock file. */
const SETUP: Readonly<
  Record<PackageManagerName, { readonly steps: readonly string[]; readonly install: string }>
> = {
  npm: { steps: [], install: "npm ci" },
  pnpm: { steps: ["      - run: corepack enable"], install: "pnpm install --frozen-lockfile" },
  yarn: { steps: ["      - run: corepack enable"], install: "yarn install --immutable" },
  bun: { steps: ["      - uses: oven-sh/setup-bun@v2"], install: "bun install --frozen-lockfile" }
};

/**
 * The workflow's text.
 *
 * @param manager - the package manager.
 * @param folder - the catalogue's folder from the repository's root, with forward slashes, plain (`isPlainFolder`); empty
 * when it is the root.
 * @param hasLockFile - whether the repository keeps a lock file, which a locked install needs.
 */
export const workflowText = (manager: PackageManagerName, folder: string, hasLockFile = true): string => {
  const { steps, install: lockedInstall } = SETUP[manager];
  const install = hasLockFile ? lockedInstall : `${manager} install`;
  const browser = forgebookCommandLine(manager, folder, "browser --with-deps");
  const verify = forgebookCommandLine(manager, folder, 'verify --since "origin/$BASE_BRANCH"');
  return [
    "# Written by `forgebook init --agents`: a pull request is not done until its changed UI ran in its stories.",
    "name: Forgebook verify",
    "",
    "on:",
    "  pull_request:",
    "",
    "permissions:",
    "  contents: read",
    "",
    "jobs:",
    "  verify:",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 30",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "        with:",
    "          fetch-depth: 0",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 24",
    ...steps,
    `      - run: ${install}`,
    `      - run: ${browser}`,
    `      - run: ${verify}`,
    "        env:",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: this is GitHub Actions' syntax, in the file it reads
    "          BASE_BRANCH: ${{ github.base_ref }}",
    ""
  ].join("\n");
};
