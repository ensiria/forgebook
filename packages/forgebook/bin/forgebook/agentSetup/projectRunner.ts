/**
 * How a file at a repository's root starts the `forgebook` of a package inside it: a hook's and CI's shell command, and an
 * MCP client's program and arguments, for each package manager.
 *
 * @remarks
 * Assistants and CI start at the repository's root, while a catalogue may live in a workspace's package, where its
 * package manager must look for the installed command. A folder goes through the shell only as a quoted string. Pure.
 *
 * @module
 */
import type { PackageManagerName } from "../newProject/newProject.types.ts";
import type { McpServer } from "./assistantHooks.ts";

/**
 * How each package manager's shell line runs the installed command: `npx` is told never to fetch one, since a file a
 * repository keeps must not start whatever a registry serves when the project has not installed it.
 */
const RUNNER: Readonly<Record<PackageManagerName, string>> = {
  npm: "npx --no forgebook",
  pnpm: "pnpm exec forgebook",
  // silent: Yarn 1 prints its banner on stdout, ahead of a hook's or a server's answer, which must be JSON alone
  yarn: "yarn --silent forgebook",
  bun: "bunx --no-install forgebook"
};

/**
 * Whether a folder's name can go into a shell's line, a workflow and a client's arguments as it is. Anything else is a
 * repository's name for a folder that a shell or GitHub Actions would read as code, so nothing is written with it.
 *
 * @param folder - the catalogue's folder from the root.
 */
export const isPlainFolder = (folder: string): boolean =>
  /^[\w./@+ -]*$/.test(folder) && !folder.startsWith("-");

/**
 * The shell command that runs `forgebook` with some arguments from the repository's root.
 *
 * @param manager - the package manager.
 * @param folder - the catalogue's folder from the root, with forward slashes, plain (`isPlainFolder`); empty when it is
 * the root.
 * @param args - the arguments, as the shell reads them.
 * @param folderBase - what the folder is written from, for an assistant that names its project's root in the environment.
 */
export const forgebookCommandLine = (
  manager: PackageManagerName,
  folder: string,
  args: string,
  folderBase = ""
): string => {
  const command = `${RUNNER[manager]} ${args}`;
  return folder === "" ? command : `cd "${folderBase}${folder}" && ${command}`;
};

/**
 * How an MCP client starts Forgebook's server from the repository's root: a client takes a program and its arguments, no
 * shell, so the folder is told to the package manager.
 *
 * @param manager - the package manager.
 * @param folder - the catalogue's folder from the root, with forward slashes; empty when it is the root.
 */
export const mcpServerOf = (manager: PackageManagerName, folder: string): McpServer => {
  const inFolder = folder !== "";
  if (manager === "pnpm")
    return { command: "pnpm", args: [...(inFolder ? ["--dir", folder] : []), "exec", "forgebook", "mcp"] };
  if (manager === "yarn")
    return {
      command: "yarn",
      args: ["--silent", ...(inFolder ? ["--cwd", folder] : []), "forgebook", "mcp"]
    };
  if (manager === "bun")
    return inFolder
      ? { command: "bun", args: ["run", "--cwd", folder, "forgebook", "mcp"] }
      : { command: "bunx", args: ["--no-install", "forgebook", "mcp"] };
  return inFolder
    ? {
        command: "npm",
        // npm finds the command through the folder, and still runs in the root: the catalogue is named
        args: [
          "--prefix",
          folder,
          "exec",
          "--no",
          "--",
          "forgebook",
          "mcp",
          "--config",
          `${folder}/forgebook.config.ts`
        ]
      }
    : { command: "npx", args: ["--no", "forgebook", "mcp"] };
};
