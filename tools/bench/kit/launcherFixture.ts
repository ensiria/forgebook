/**
 * A bare machine for the bench kit's launchers, without the network: the pinned downloads served from this process, a
 * Node that hands over to the one running the tests, a corepack, a pnpm and a Forgebook of a few lines.
 *
 * @remarks
 * A launcher is a long script whose steps depend on each other, and a mistake in how one step leaves its variables
 * only shows in a later one, so a launcher is tested by running it from its first line. `start-bench.ps1` runs here in
 * PowerShell 7 on macOS and Linux, with what only Windows has standing in for it: `SystemRoot` is a folder holding a
 * `tar.exe`, the runtime's DLLs and a `taskkill.exe`, and `Get-CimInstance` a function of the script that calls the
 * launcher. Everything else in the launcher runs as written. The real one runs on Windows in CI's `windows` job.
 *
 * @module
 */
import { type ExecFileException, execFile, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { processIo } from "@ensiria/cli-kit/io";

import { zipArchive } from "./zipArchive.ts";

/** The user's name in every fixture: the launchers must take it out of what they archive. */
export const USER_NAME = "mario.rossi";

/** The computer's name in the Windows launcher's fixture. */
export const COMPUTER_NAME = "MINIPC-TEST";

/** How long a launcher may take in a test, in milliseconds. */
const LAUNCH_LIMIT_MS = 170_000;

/** A launch of a launcher. */
export type Launch = {
  /** Its exit code. */
  readonly code: number;
  /** What it wrote to stdout and stderr. */
  readonly output: string;
};

/** A program the fixture's fakes recorded as run. */
export type Recorded = {
  /** Which fake: `corepack` or `kit`. */
  readonly tool: string;
  /** The script Node was given. */
  readonly script: string;
  /** Its arguments. */
  readonly args: readonly string[];
  /** The first folder of the `PATH` it saw. */
  readonly firstPath: string;
};

/** What a fixture is built with. */
export type FixtureOptions = {
  /** Whether activating pnpm fails, as it did on the first Windows machine. */
  readonly isCorepackBroken?: boolean;
  /** Whether the folder holds a Forgebook installed by an earlier launch, whose kit has no `--results`. */
  readonly hasStaleRepo?: boolean;
};

/** A bare machine, with its downloads being served. */
export type Fixture = {
  /** The launcher's own folder, as the person copied it. */
  readonly kitFolder: string;
  /** The folder the kit installs into. */
  readonly kitHome: string;
  /** The user's home folder. */
  readonly userFolder: string;
  /** The Desktop. */
  readonly desktop: string;
  /** The folder standing for `SystemRoot`. */
  readonly systemRoot: string;
  /** What the fakes recorded so far. */
  readonly recorded: () => readonly Recorded[];
  /** Makes the fake kit's next `--results` fail. */
  readonly refuseResults: () => void;
  /** Stops serving and removes everything. */
  readonly close: () => Promise<void>;
};

/** Runs a program to its end, and returns its stdout. */
const run = (program: string, args: readonly string[], cwd?: string): string => {
  const result = spawnSync(program, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${program} ${args.join(" ")}: ${result.stderr}`);
  return result.stdout;
};

/** Writes a text file, with its folders. */
const write = (file: string, text: string): void => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
};

/** Writes an executable text file, with its folders. */
const writeProgram = (file: string, text: string): void => {
  write(file, text);
  chmodSync(file, 0o755);
};

/** The line a fake program records itself with: its name, what Node ran, its arguments, the `PATH` it saw. */
const recording = (tool: string, record: string): string =>
  `require("node:fs").appendFileSync(${JSON.stringify(record)}, JSON.stringify({ tool: ${JSON.stringify(tool)}, ` +
  'script: process.argv[1], args: process.argv.slice(2), firstPath: process.env.PATH.split(require("node:path").delimiter)[0] }) + "\\n");\n';

/** A pnpm that leaves what a real install and Playwright's download would leave. */
const PNPM = `#!/bin/sh
case "$1" in
  install) mkdir -p node_modules ;;
  *) mkdir -p "$PLAYWRIGHT_BROWSERS_PATH" ;;
esac
`;

/** A corepack that records itself and writes the pnpm it was asked for, or fails. */
const corepackScript = (record: string, isBroken: boolean): string =>
  recording("corepack", record) +
  (isBroken
    ? 'console.error("corepack cannot run here"); process.exit(1);\n'
    : `const args = process.argv.slice(2);
const pnpm = require("node:path").join(args[args.indexOf("--install-directory") + 1], "pnpm");
require("node:fs").writeFileSync(pnpm, ${JSON.stringify(PNPM)}, { mode: 0o755 });
`);

/** The kit of an older launch: the option the launchers pass after a failure did not exist. */
const STALE_KIT = `console.error("Unknown option '--results'");
process.exit(2);
`;

/** The kit's Node part: records itself, and writes the results file when asked unless told to refuse. */
const kitScript = (record: string): string =>
  `const { existsSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
${recording("kit", record)}const args = process.argv.slice(2);
if (args.includes("--results")) {
  if (existsSync(join(args[args.indexOf("--home") + 1], "refuse-results"))) process.exit(1);
  writeFileSync(join(args[args.indexOf("--desktop") + 1], "forgebook-bench-risultati-kit.zip"), "");
}
`;

/** Commits a Forgebook holding this kit, and returns the commit. */
const commitKit = (repository: string, kit: string): string => {
  write(join(repository, "tools/bench/kit/kit.cjs"), kit);
  write(join(repository, "tools/bench/kit/kit.mts"), 'import "./kit.cjs";\n');
  write(join(repository, ".gitignore"), "node_modules\n");
  run("git", ["add", "."], repository);
  const identity = ["-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid"];
  run("git", [...identity, "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "kit"], repository);
  return run("git", ["rev-parse", "HEAD"], repository).trim();
};

/** The SHA-256 of a buffer, as the pins hold it. */
const sha256 = async (data: Buffer): Promise<string> => {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(data).digest("hex");
};

/** Serves files from memory on a port of its own. */
const serve = async (files: ReadonlyMap<string, Buffer>): Promise<{ server: Server; port: number }> => {
  const server = createServer((request, response) => {
    const file = files.get(request.url ?? "");
    response.statusCode = file === undefined ? 404 : 200;
    response.end(file);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address: AddressInfo | string | null = server.address();
  if (address === null || typeof address === "string") throw new Error("no port");
  return { server, port: address.port };
};

/** The name of this machine's platform in `kit.pins`, as `start-bench.sh` builds it. */
const unixPlatform = (): string =>
  `${process.platform === "darwin" ? "darwin" : "linux"}-${process.arch === "arm64" ? "arm64" : "x64"}`;

/**
 * Builds a bare machine.
 *
 * @param launchers - the launcher files to copy to its kit folder, from this folder.
 * @param options - how it differs from a machine where everything works.
 */
export const makeFixture = async (
  launchers: readonly string[],
  options: FixtureOptions = {}
): Promise<Fixture> => {
  // a name with a space and a dot: every path the launchers build goes through quoting
  const root = join(realpathSync(mkdtempSync(join(tmpdir(), "kit launcher "))), "machine");
  const userFolder = join(root, "Users", USER_NAME);
  const kitHome = join(userFolder, "AppData", "Forgebook Bench");
  const desktop = join(userFolder, "Desktop");
  const kitFolder = join(root, "copied kit");
  const record = join(root, "recorded.jsonl");
  write(record, "");
  mkdirSync(desktop, { recursive: true });
  for (const launcher of launchers) {
    writeProgram(join(kitFolder, launcher), readFileSync(join(import.meta.dirname, launcher), "utf8"));
  }

  const systemRoot = join(root, "SystemRoot");
  writeProgram(
    join(systemRoot, "System32", "tar.exe"),
    `#!/bin/sh
unzip -q "$2" -d "$4" && find "$4" -type f -name '*.exe' -exec chmod +x {} +
`
  );
  writeProgram(join(systemRoot, "System32", "taskkill.exe"), "#!/bin/sh\n");
  for (const library of ["vcruntime140.dll", "vcruntime140_1.dll", "msvcp140.dll"]) {
    write(join(systemRoot, "System32", library), "");
  }

  const repository = join(root, "forgebook");
  mkdirSync(repository);
  run("git", ["init", "--quiet"], repository);
  const staleCommit = commitKit(repository, STALE_KIT);
  const commit = commitKit(repository, kitScript(record));

  if (options.hasStaleRepo === true) {
    const repo = join(kitHome, "repo");
    mkdirSync(dirname(repo), { recursive: true });
    run("git", ["clone", "--quiet", repository, repo]);
    run("git", ["-C", repo, "checkout", "--quiet", staleCommit]);
    write(join(repo, "node_modules", ".kit-installed"), `${staleCommit}\n`);
  }

  const corepack = corepackScript(record, options.isCorepackBroken === true);
  const nodeWrapper = `#!/bin/sh\nexec "${process.execPath}" "$@"\n`;
  const entry = (name: string, text: string): { readonly name: string; readonly data: Buffer } => ({
    name,
    data: Buffer.from(text)
  });
  const windowsNode = zipArchive(
    [
      entry("node-v0/node.exe", nodeWrapper),
      entry("node-v0/node_modules/corepack/dist/corepack.js", corepack)
    ],
    new Date()
  );
  const minGit = zipArchive([entry("cmd/.keep", ""), entry("usr/bin/.keep", "")], new Date());

  const unixNodeFolder = join(root, "unix-node");
  writeProgram(join(unixNodeFolder, "node-v0", "bin", "node"), nodeWrapper);
  writeProgram(
    join(unixNodeFolder, "node-v0", "bin", "corepack"),
    `#!/bin/sh\nexec "${process.execPath}" "${join(unixNodeFolder, "corepack.cjs")}" "$@"\n`
  );
  write(join(unixNodeFolder, "corepack.cjs"), corepack);
  const unixNodeArchive = join(unixNodeFolder, "node.tar.gz");
  run("tar", ["-czf", unixNodeArchive, "-C", unixNodeFolder, "node-v0"]);
  const unixNode = readFileSync(unixNodeArchive);

  const { server, port } = await serve(
    new Map([
      ["/node.zip", windowsNode],
      ["/mingit.zip", minGit],
      ["/node.tar.gz", unixNode]
    ])
  );
  const url = `http://127.0.0.1:${port}`;
  const [windowsNodeSum, minGitSum, unixNodeSum] = await Promise.all([
    sha256(windowsNode),
    sha256(minGit),
    sha256(unixNode)
  ]);
  const pins = [
    `forgebook.repository=file://${repository}`,
    `forgebook.commit=${commit}`,
    "node.version=0.0.0",
    "mingit.version=0.0.0",
    `node.${unixPlatform()}.url=${url}/node.tar.gz`,
    `node.${unixPlatform()}.sha256=${unixNodeSum}`,
    ...["win-x64", "win-arm64"].flatMap((platform) => [
      `node.${platform}.url=${url}/node.zip`,
      `node.${platform}.sha256=${windowsNodeSum.toUpperCase()}`,
      `mingit.${platform}.url=${url}/mingit.zip`,
      `mingit.${platform}.sha256=${minGitSum.toUpperCase()}`
    ])
  ];
  write(join(kitFolder, "kit.pins"), `${pins.join("\n")}\n`);

  return {
    kitFolder,
    kitHome,
    userFolder,
    desktop,
    systemRoot,
    recorded: () =>
      readFileSync(record, "utf8")
        .split("\n")
        .filter((line) => line !== "")
        .map((line): Recorded => JSON.parse(line)),
    refuseResults: () => {
      write(join(kitHome, "refuse-results"), "");
    },
    close: async () => {
      await new Promise((resolve) => {
        server.close(resolve);
      });
      rmSync(dirname(root), { recursive: true, force: true });
    }
  };
};

/** Runs a program with exactly this environment, to its end, without blocking the server in this process. */
const launch = (
  program: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  cwd: string
): Promise<Launch> =>
  new Promise((resolve) => {
    execFile(
      program,
      args,
      { env, cwd, timeout: LAUNCH_LIMIT_MS, maxBuffer: 16 * 1024 * 1024 },
      (error: ExecFileException | null, stdout: string, stderr: string) => {
        const failedCode = typeof error?.code === "number" ? error.code : 1;
        resolve({ code: error === null ? 0 : failedCode, output: stdout + stderr });
      }
    );
  });

/** What every launcher reads of its machine. */
const baseEnv = (fixture: Fixture, path: string): NodeJS.ProcessEnv => ({
  PATH: path,
  HOME: fixture.userFolder,
  TMPDIR: tmpdir(),
  LANG: "C.UTF-8",
  FORGEBOOK_BENCH_HOME: fixture.kitHome,
  FORGEBOOK_BENCH_DESKTOP: fixture.desktop,
  FORGEBOOK_BENCH_NO_PAUSE: "1"
});

/**
 * What `Start-Process` does with its input on Windows, standing in for what it does elsewhere: there the input file
 * becomes the program's stdin, while PowerShell outside Windows writes a line to a pipe once the program has started, and
 * throws "Broken pipe" at the launcher when the program has already ended. No program of these flows reads its stdin.
 */
const START_PROCESS_STAND_IN = `function Start-Process {
  [CmdletBinding()]
  param($FilePath, $ArgumentList, [switch] $NoNewWindow, [switch] $PassThru, $RedirectStandardOutput, $RedirectStandardError, $RedirectStandardInput)
  [void] $PSBoundParameters.Remove('RedirectStandardInput')
  Microsoft.PowerShell.Management\\Start-Process @PSBoundParameters
}`;

/**
 * Runs `start-bench.ps1` in PowerShell 7 with what only Windows has standing in for it.
 *
 * @param fixture - the machine.
 * @param args - the launcher's arguments.
 */
export const launchWindows = (fixture: Fixture, args: readonly string[]): Promise<Launch> => {
  const standIn = join(fixture.systemRoot, "launch.ps1");
  write(
    standIn,
    `function Get-CimInstance { [pscustomobject]@{ TotalPhysicalMemory = 17179869184 } }
${START_PROCESS_STAND_IN}
& ${JSON.stringify(join(fixture.kitFolder, "start-bench.ps1")).replaceAll('"', "'")} @args
exit $LASTEXITCODE
`
  );
  return launch(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-File", standIn, ...args],
    {
      ...baseEnv(fixture, processIo().env["PATH"] ?? ""),
      SystemRoot: fixture.systemRoot,
      USERPROFILE: fixture.userFolder,
      USERNAME: USER_NAME,
      COMPUTERNAME: COMPUTER_NAME
    },
    fixture.kitFolder
  );
};

/**
 * Runs `start-bench.sh`.
 *
 * @param fixture - the machine.
 * @param args - the launcher's arguments.
 * @param machineUser - the `PATH`, when it is not this process's, and the user's name, when it is not `USER_NAME`.
 */
export const launchUnix = (
  fixture: Fixture,
  args: readonly string[],
  { path = processIo().env["PATH"] ?? "", user = USER_NAME }: { path?: string; user?: string } = {}
): Promise<Launch> =>
  launch(
    "bash",
    [join(fixture.kitFolder, "start-bench.sh"), ...args],
    // a locale that folds letters outside ASCII, which each system names its own way
    {
      ...baseEnv(fixture, path),
      USER: user,
      LANG: process.platform === "darwin" ? "en_US.UTF-8" : "C.UTF-8"
    },
    fixture.kitFolder
  );

/**
 * The names and the text of an archive, read with the system's tools.
 *
 * @param file - a `.zip` or a `.tar.gz`.
 */
export const readArchive = (file: string): { readonly names: readonly string[]; readonly text: string } =>
  file.endsWith(".zip")
    ? {
        names: run("unzip", ["-Z1", file]).split("\n").filter(Boolean),
        text: run("unzip", ["-p", file])
      }
    : {
        names: run("tar", ["-tzf", file]).split("\n").filter(Boolean),
        text: run("tar", ["-xzOf", file])
      };
