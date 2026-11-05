/**
 * How a program is started: the Windows shims read, and every other system left alone.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { invocation, type ProgramSystem, shimScript } from "./programs.ts";

/** A shim as npm's `cmd-shim` writes it, in a project's `node_modules\.bin`. */
const NPM_SHIM = `@ECHO off\r
GOTO start\r
:find_dp0\r
SET dp0=%~dp0\r
EXIT /b\r
:start\r
SETLOCAL\r
CALL :find_dp0\r
\r
IF EXIST "%dp0%\\node.exe" (\r
  SET "_prog=%dp0%\\node.exe"\r
) ELSE (\r
  SET "_prog=node"\r
  SET PATHEXT=%PATHEXT:;.JS;=;%\r
)\r
\r
endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\..\\forgebook\\dist\\bin\\forgebook.js" %*\r
`;

/** A shim as pnpm, Yarn and corepack write it (`@zkochan/cmd-shim`). */
const ZKOCHAN_SHIM = `@SETLOCAL
@IF NOT DEFINED NODE_PATH (
  @SET "NODE_PATH=C:\\kit\\node_modules\\.pnpm\\node_modules"
) ELSE (
  @SET "NODE_PATH=%NODE_PATH%;C:\\kit\\node_modules\\.pnpm\\node_modules"
)
@IF EXIST "%~dp0\\node.exe" (
  "%~dp0\\node.exe"  "%~dp0\\..\\node\\node_modules\\corepack\\dist\\pnpm.js" %*
) ELSE (
  @SET PATHEXT=%PATHEXT:;.JS;=;%
  node  "%~dp0\\..\\node\\node_modules\\corepack\\dist\\pnpm.js" %*
)
`;

/** Node's own `npm.cmd`, which sets the script in a variable and may override it from a global prefix. */
const NODE_NPM = `:: Created by npm, please don't edit manually.
@ECHO OFF

SETLOCAL

SET "NODE_EXE=%~dp0\\node.exe"
IF NOT EXIST "%NODE_EXE%" (
  SET "NODE_EXE=node"
)

SET "NPM_PREFIX_JS=%~dp0\\node_modules\\npm\\bin\\npm-prefix.js"
SET "NPM_CLI_JS=%~dp0\\node_modules\\npm\\bin\\npm-cli.js"
FOR /F "delims=" %%F IN ('CALL "%NODE_EXE%" "%NPM_PREFIX_JS%"') DO (
  SET "NPM_PREFIX_NPM_CLI_JS=%%F\\node_modules\\npm\\bin\\npm-cli.js"
)
IF EXIST "%NPM_PREFIX_NPM_CLI_JS%" (
  SET "NPM_CLI_JS=%NPM_PREFIX_NPM_CLI_JS%"
)

"%NODE_EXE%" "%NPM_CLI_JS%" %*
`;

describe("shimScript", () => {
  it("reads npm's shim of a package's command", () => {
    expect(shimScript(NPM_SHIM, "C:\\work\\forgebook\\node_modules\\.bin")).toBe(
      "C:\\work\\forgebook\\node_modules\\forgebook\\dist\\bin\\forgebook.js"
    );
  });

  it("reads the shim pnpm, Yarn and corepack write, past the interpreter", () => {
    expect(shimScript(ZKOCHAN_SHIM, "C:\\kit\\bin")).toBe(
      "C:\\kit\\node\\node_modules\\corepack\\dist\\pnpm.js"
    );
  });

  it("reads Node's npm.cmd through its variable, keeping the default over an override known only at run time", () => {
    expect(shimScript(NODE_NPM, "C:\\kit\\node")).toBe("C:\\kit\\node\\node_modules\\npm\\bin\\npm-cli.js");
  });

  it("says nothing of a file that runs no script", () => {
    expect(shimScript("@echo off\r\necho hello\r\n", "C:\\x")).toBeUndefined();
  });
});

/** A Windows system holding these files. */
const windows = (files: Readonly<Record<string, string>>): ProgramSystem => ({
  platform: "win32",
  node: "C:\\kit\\node\\node.exe",
  isFile: (path) => path in files,
  read: (path) => files[path] ?? ""
});

describe("invocation", () => {
  const where = { cwd: "C:\\work\\forgebook", env: { Path: "C:\\kit\\node;C:\\kit\\git\\cmd" } };

  it("leaves a program alone off Windows", () => {
    const system = { ...windows({}), platform: "linux" as const };
    expect(invocation("npm", ["ci"], where, system)).toEqual({ program: "npm", args: ["ci"] });
  });

  it("runs a program Windows finds as an executable as itself", () => {
    const system = windows({ "C:\\kit\\git\\cmd\\git.exe": "" });
    expect(invocation("git", ["status"], where, system)).toEqual({
      program: "C:\\kit\\git\\cmd\\git.exe",
      args: ["status"]
    });
  });

  it("runs a shim on the PATH as Node on its script, whatever the case of the PATH variable", () => {
    const system = windows({ "C:\\kit\\node\\npm.cmd": NODE_NPM });
    expect(invocation("npm", ["ci"], where, system)).toEqual({
      program: "C:\\kit\\node\\node.exe",
      args: ["C:\\kit\\node\\node_modules\\npm\\bin\\npm-cli.js", "ci"]
    });
  });

  it("finds the shim of a path in node_modules, relative to the folder it runs in", () => {
    const system = windows({ "C:\\work\\forgebook\\node_modules\\.bin\\forgebook.cmd": NPM_SHIM });
    expect(invocation("node_modules/.bin/forgebook", ["dev"], where, system).args).toEqual([
      "C:\\work\\forgebook\\node_modules\\forgebook\\dist\\bin\\forgebook.js",
      "dev"
    ]);
  });

  it("leaves a program it cannot find as named, so the error names it", () => {
    expect(invocation("sh", ["-c", "true"], where, windows({}))).toEqual({
      program: "sh",
      args: ["-c", "true"]
    });
  });

  it("refuses a shim it cannot read rather than guess", () => {
    const system = windows({ "C:\\kit\\node\\odd.cmd": "@echo off\r\n" });
    expect(() => invocation("odd", [], where, system)).toThrow(/not a command shim/);
  });
});
