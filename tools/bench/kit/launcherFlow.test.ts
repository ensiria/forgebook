/**
 * The launchers run from their first line on a bare machine (`launcherFixture.ts`), and the variables of the Windows
 * one checked: PowerShell's names ignore case, so `$node` and `$script:Node` are one variable.
 *
 * @remarks
 * PowerShell comes from the machine: CI's runners have it, on Linux and on Windows, and CI fails when it is missing;
 * elsewhere the PowerShell tests are skipped. The flows run on macOS and Linux, since their fakes are shell scripts;
 * the real launcher runs on Windows in CI's `windows` job.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { hostname, tmpdir, userInfo } from "node:os";
import { join } from "node:path";

import { isCi, processIo } from "@ensiria/cli-kit/io";
import { afterEach, describe, expect, it } from "vitest";

import { powershellArgs } from "../powershell.ts";
import {
  COMPUTER_NAME,
  type Fixture,
  type FixtureOptions,
  type Launch,
  launchUnix,
  launchWindows,
  makeFixture,
  readArchive,
  USER_NAME
} from "./launcherFixture.ts";

/** Whether this machine has PowerShell 7. */
const hasPwsh = spawnSync("pwsh", ["-NoProfile", "-Command", "exit 0"]).status === 0;

/** Whether the launcher's flows can run here: their fake programs are shell scripts. */
const isUnix = process.platform !== "win32";

/** A launcher's flow starts PowerShell or waits on several programs. */
const FLOW_LIMIT_MS = 180_000;

/**
 * The script that lists a PowerShell file's variables, from the language's own parser: the spelling of every name with
 * its scope taken out, and the parse errors. Variables of the `env:` drive stay out: they are the system's, not the
 * script's. The dictionary is ordinal because a PowerShell hashtable would itself fold the spellings together.
 */
const VARIABLES_SCRIPT = `
$errors = $null; $tokens = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($env:KIT_PS1, [ref] $tokens, [ref] $errors)
$lines = [Collections.Generic.Dictionary[string, Collections.ArrayList]]::new([StringComparer]::Ordinal)
foreach ($found in $ast.FindAll({ param($item) $item -is [Management.Automation.Language.VariableExpressionAst] }, $true)) {
  $path = $found.VariablePath
  if ($path.IsDriveQualified -and -not ($path.IsScript -or $path.IsGlobal -or $path.IsLocal -or $path.IsPrivate)) { continue }
  $bare = $path.UserPath -replace '^(script|global|local|private|using):', ''
  if (-not $lines.ContainsKey($bare)) { $lines[$bare] = [Collections.ArrayList]::new() }
  [void] $lines[$bare].Add($found.Extent.StartLineNumber)
}
$collisions = @($lines.Keys | Group-Object { $_.ToLowerInvariant() } | Where-Object { $_.Count -gt 1 } | ForEach-Object {
  ($_.Group | ForEach-Object { "$_ (" + ($lines[$_] -join ', ') + ')' }) -join ' / '
})
ConvertTo-Json -Compress @{ errors = @($errors | ForEach-Object { $_.Message }); collisions = $collisions }
`;

/** A PowerShell file's parse errors, and the names it spells in more than one way. */
const inspectVariables = (file: string): { errors: string[]; collisions: string[] } => {
  const result = spawnSync("pwsh", powershellArgs(VARIABLES_SCRIPT), {
    encoding: "utf8",
    env: { ...processIo().env, KIT_PS1: file }
  });
  const parsed: { errors: string[]; collisions: string[] } = JSON.parse(result.stdout);
  return parsed;
};

describe.runIf(hasPwsh)("start-bench.ps1's variables", () => {
  it("parses, and spells every variable one way", () => {
    expect(inspectVariables(join(import.meta.dirname, "start-bench.ps1"))).toEqual({
      errors: [],
      collisions: []
    });
  }, 60_000);

  it("finds a name spelled two ways, across scopes, parameters and strings", () => {
    const folder = mkdtempSync(join(tmpdir(), "kit-variables-"));
    const file = join(folder, "sample.ps1");
    writeFileSync(
      file,
      [
        "$node = 'folder'",
        "$script:Node = Join-Path $node 'node.exe'",
        "function Work([string] $Text) { $Text }",
        '$sample = "$TEXT;"',
        "$env:Path = $env:PATH",
        "$fine = 1; $script:fine = 2"
      ].join("\n")
    );
    const { collisions } = inspectVariables(file);
    rmSync(folder, { recursive: true });
    expect(collisions.toSorted()).toEqual(["Text (3, 3) / TEXT (4)", "node (1, 2) / Node (2)"]);
  }, 60_000);
});

it.skipIf(hasPwsh || !isCi(processIo().env))("has PowerShell on CI", () => {
  expect(hasPwsh).toBe(true);
});

/** What each test built, removed after it. */
const built: Fixture[] = [];

afterEach(async () => {
  for (const fixture of built.splice(0)) await fixture.close();
});

/** A bare machine holding both launchers. */
const machine = async (options?: FixtureOptions): Promise<Fixture> => {
  const fixture = await makeFixture(["start-bench.ps1", "start-bench.sh"], options);
  built.push(fixture);
  return fixture;
};

/** The files on the Desktop. */
const onDesktop = (fixture: Fixture): string[] => readdirSync(fixture.desktop).toSorted();

/** Reads the one archive of the launcher's logs on the Desktop. */
const logsArchive = (fixture: Fixture): ReturnType<typeof readArchive> => {
  const files = onDesktop(fixture).filter((name) => name.startsWith("forgebook-bench-registri-"));
  expect(files).toHaveLength(1);
  return readArchive(join(fixture.desktop, files[0] ?? ""));
};

/** Asserts that a launch failed at pnpm's activation and left the cleaned logs. */
const expectLogsAfterActivationFailed = (fixture: Fixture, launched: Launch): void => {
  expect(launched.output).toContain("non è riuscito (codice 1)");
  expect(launched.code).toBe(1);
  const { names, text } = logsArchive(fixture);
  expect(names).toContain("launcher.log");
  // the step's error log on Windows, its only log elsewhere
  expect(text).toContain("corepack cannot run here");
  expect(text.toLowerCase()).not.toContain(USER_NAME);
  expect(text).not.toContain(COMPUTER_NAME);
  expect(text).toContain("~");
};

/** This computer's name without its domain. */
const shortHostname = (): string => hostname().split(".")[0] ?? "";

/** The launchers, each with how it is run and what it calls corepack. */
const LAUNCHERS = [
  { name: "start-bench.ps1", isRunnable: hasPwsh && isUnix, launchIt: launchWindows },
  { name: "start-bench.sh", isRunnable: isUnix, launchIt: launchUnix }
] as const;

for (const { name, isRunnable, launchIt } of LAUNCHERS) {
  describe.runIf(isRunnable)(`${name}, from its first line`, () => {
    it(
      "activates pnpm, clones, installs and hands over to the kit's Node part",
      async () => {
        const fixture = await machine();
        const launched = await launchIt(fixture, ["--help"]);
        expect(launched.output).not.toContain("Errore");
        expect(launched.code).toBe(0);
        const recorded = fixture.recorded();
        const corepack = recorded.find(({ tool }) => tool === "corepack");
        expect(corepack?.args).toEqual([
          "enable",
          "--install-directory",
          join(fixture.kitHome, "bin"),
          "pnpm",
          "yarn"
        ]);
        const kit = recorded.find(({ tool }) => tool === "kit");
        expect(kit?.args).toEqual(["--home", fixture.kitHome, "--desktop", fixture.desktop, "--help"]);
        expect(kit?.firstPath).toMatch(/(?:node-v0|node-0\.0\.0-[a-z0-9-]+\/bin)$/);
        const log = readFileSync(join(fixture.kitHome, "logs", "launcher.log"), "utf8");
        expect(log).toContain("Kit finito (codice 0)");
      },
      FLOW_LIMIT_MS
    );

    it(
      "zips its own logs when pnpm cannot be activated",
      async () => {
        const fixture = await machine({ isCorepackBroken: true });
        expectLogsAfterActivationFailed(fixture, await launchIt(fixture, []));
      },
      FLOW_LIMIT_MS
    );

    it(
      "does not run the older kit an earlier launch left: it zips its own logs",
      async () => {
        const fixture = await machine({ isCorepackBroken: true, hasStaleRepo: true });
        const launched = await launchIt(fixture, []);
        expectLogsAfterActivationFailed(fixture, launched);
        expect(launched.output).not.toContain("Unknown option");
      },
      FLOW_LIMIT_MS
    );

    it(
      "cleans what its logs hold of any name and folder, whatever the case",
      async () => {
        const fixture = await machine();
        const logs = join(fixture.kitHome, "logs");
        mkdirSync(logs, { recursive: true });
        const computers = name === "start-bench.ps1" ? [COMPUTER_NAME] : [hostname(), shortHostname()];
        const lines = [
          ...computers.map((computer) => `on ${computer} and ${computer.toUpperCase()} `),
          `by ${USER_NAME.toUpperCase()} ${USER_NAME} ${USER_NAME}`,
          "read /home/other.person/file and /USERS/another/file",
          "read C:\\Users\\third.one\\file and C:\\\\Users\\\\fourth.one\\\\file",
          "in OneDrive - Contoso SpA\\file"
        ];
        writeFileSync(join(logs, "other.log"), `${lines.join("\n")}\n`);
        expect((await launchIt(fixture, ["--results"])).code).toBe(0);
        const text = logsArchive(fixture).text.toLowerCase();
        const gone = [
          ...computers,
          USER_NAME,
          "other.person",
          "another",
          "third.one",
          "fourth.one",
          "Contoso"
        ];
        for (const left of gone) expect(text).not.toContain(left.toLowerCase());
      },
      FLOW_LIMIT_MS
    );

    it(
      "brings a folder an earlier launch left to the pinned commit",
      async () => {
        const fixture = await machine({ hasStaleRepo: true });
        expect((await launchIt(fixture, ["--results"])).output).not.toContain("Unknown option");
        expect((await launchIt(fixture, ["--help"])).code).toBe(0);
        expect(fixture.recorded().find(({ tool }) => tool === "kit")?.args).toContain("--help");
      },
      FLOW_LIMIT_MS
    );

    it(
      "zips its logs for --results on a folder with nothing installed",
      async () => {
        const fixture = await machine();
        const launched = await launchIt(fixture, ["--results"]);
        expect(launched.code).toBe(0);
        expect(logsArchive(fixture).names).toContain("launcher.log");
      },
      FLOW_LIMIT_MS
    );

    it(
      "asks the installed kit for the results, and zips its logs when the kit fails",
      async () => {
        const fixture = await machine();
        expect((await launchIt(fixture, ["--help"])).code).toBe(0);
        expect((await launchIt(fixture, ["--results"])).code).toBe(0);
        expect(onDesktop(fixture)).toEqual(["forgebook-bench-risultati-kit.zip"]);
        fixture.refuseResults();
        expect((await launchIt(fixture, ["--results"])).code).toBe(0);
        expect(logsArchive(fixture).names).toContain("launcher.log");
      },
      FLOW_LIMIT_MS
    );
  });
}

/** The programs `start-bench.sh` needs as far as its failure path, none of which makes a zip. */
const WITHOUT_ZIP_TOOLS = [
  "awk",
  "basename",
  "bash",
  "cat",
  "curl",
  "cut",
  "date",
  "df",
  "dirname",
  "find",
  "git",
  "grep",
  "gzip",
  "head",
  "hostname",
  "id",
  "mkdir",
  "mktemp",
  "mv",
  "rm",
  "sed",
  "sha256sum",
  "shasum",
  "sleep",
  "sysctl",
  "tail",
  "tar",
  "touch",
  "tr",
  "uname",
  "wc"
];

/** A program's stdout. */
const run = (program: string, args: readonly string[]): string =>
  spawnSync(program, args, { encoding: "utf8" }).stdout;

/** A `PATH` of one folder holding these programs, those this machine has. */
const pathOf = (root: string, programs: readonly string[]): string => {
  const folder = join(root, "bin-for-test");
  mkdirSync(folder);
  for (const program of programs) {
    const found = spawnSync("sh", ["-c", `command -v ${program}`], { encoding: "utf8" }).stdout.trim();
    if (found !== "") symlinkSync(found, join(folder, program));
  }
  return folder;
};

describe.runIf(isUnix)("the kit's zip", () => {
  it("keeps the Windows launchers' line endings when archived as the README says", () => {
    const folder = mkdtempSync(join(tmpdir(), "kit-zip-"));
    const file = join(folder, "kit.zip");
    const archive = ["archive", "--format=zip", "--prefix=kit/", "--mtime=2026-01-01T00:00:00Z", "-o", file];
    spawnSync("git", [...archive, "HEAD:tools/bench/kit"], { cwd: join(import.meta.dirname, "../../..") });
    const launchers = ["kit/start-bench.cmd", "kit/start-bench.ps1"].map((name) =>
      run("unzip", ["-p", file, name])
    );
    rmSync(folder, { recursive: true });
    for (const text of launchers) {
      expect(text.length).toBeGreaterThan(0);
      expect(text.split("\r\n").length).toBe(text.split("\n").length);
    }
  });
});

describe.runIf(isUnix)("start-bench.sh's logs, on its own", () => {
  it(
    "falls back to a tar.gz on a machine with neither zip nor Python",
    async () => {
      const fixture = await machine({ isCorepackBroken: true });
      const launched = await launchUnix(fixture, [], { path: pathOf(fixture.userFolder, WITHOUT_ZIP_TOOLS) });
      expect(launched.code).toBe(1);
      const [archive] = onDesktop(fixture);
      expect(archive).toMatch(/^forgebook-bench-registri-.*\.tar\.gz$/);
      const { names, text } = readArchive(join(fixture.desktop, archive ?? ""));
      expect(names).toContain("./launcher.log");
      expect(text.toLowerCase()).not.toContain(USER_NAME);
      expect(run("tar", ["-tvzf", join(fixture.desktop, archive ?? "")])).not.toContain(userInfo().username);
    },
    FLOW_LIMIT_MS
  );

  it(
    "archives nothing when a name is left, and never loops on a name found in its placeholder",
    async () => {
      const refused = await machine({ isCorepackBroken: true });
      const logs = join(refused.kitHome, "logs");
      mkdirSync(logs, { recursive: true });
      writeFileSync(join(logs, "other.log"), "signed MÁRIO\n");
      const launched = await launchUnix(refused, [], { user: "mário" });
      expect(launched.output).toContain("contiene ancora dati personali");
      expect(onDesktop(refused)).toEqual([]);

      const named = await machine({ isCorepackBroken: true });
      expect((await launchUnix(named, [], { user: "user" })).code).toBe(1);
      expect(logsArchive(named).names).toContain("launcher.log");
    },
    FLOW_LIMIT_MS
  );
});
