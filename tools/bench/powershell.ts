/**
 * PowerShell, run from Node on Windows: what the benchmark reads of the system there (the machine's load, its
 * processes) has no command of its own.
 *
 * @remarks
 * The script goes in encoded, as PowerShell's `-EncodedCommand` takes it (UTF-16LE in base64), so no quoting rule of
 * `cmd.exe` or of PowerShell's own command line can change it on the way.
 *
 * @module
 */
import { exec } from "@ensiria/cli-kit/exec";
import type { ScriptIo } from "@ensiria/cli-kit/io.types";

/**
 * The arguments that run a script in a PowerShell without the user's profile and without prompts.
 *
 * @param script - the script's text.
 */
export const powershellArgs = (script: string): string[] => [
  "-NoLogo",
  "-NoProfile",
  "-NonInteractive",
  "-ExecutionPolicy",
  "Bypass",
  "-EncodedCommand",
  Buffer.from(script, "utf16le").toString("base64")
];

/**
 * Runs a script that prints one JSON document, and parses it.
 *
 * @param script - the script; what it writes to stdout must be JSON.
 * @param io - the script's streams.
 * @returns the document, or nothing when the script failed or printed no JSON: a reading is never worth a failed run.
 */
export const powershellJson = async (script: string, io: ScriptIo): Promise<unknown> => {
  const { stdout, code } = await exec("powershell.exe", powershellArgs(script), {
    io,
    output: "capture",
    check: false
  });
  if (code !== 0) return undefined;
  try {
    return JSON.parse(stdout);
  } catch {
    return undefined;
  }
};
