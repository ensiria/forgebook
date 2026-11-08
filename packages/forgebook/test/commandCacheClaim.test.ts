/**
 * Tests for the claim on the cache folder of a server a command starts: one live server at a time on the shared folder,
 * another on a folder of its own, and what a process that is gone left behind taken over or removed.
 *
 * @module
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { claimCommandCache, isProcessRunning } from "../bin/forgebook/commandCacheClaim.ts";

/** A shared folder's path in a new temporary cache folder. */
const sharedFolder = (): string => join(mkdtempSync(join(tmpdir(), "forgebook-cache-claim-")), "commands");

/** The number of a process that has ended. */
const endedPid = (): number => {
  const run = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], {
    encoding: "utf8"
  });
  return Number(run.stdout);
};

describe("claimCommandCache", () => {
  it("gives the shared folder to the first server, and locks it with the process", () => {
    const shared = sharedFolder();
    const claim = claimCommandCache(shared);
    expect(claim).toMatchObject({ folder: shared, isShared: true });
    expect(readFileSync(`${shared}.lock`, "utf8")).toBe(String(process.pid));
    claim.release();
    expect(existsSync(`${shared}.lock`)).toBe(false);
  });

  it("gives a second server at once a folder of its own, removed when it closes", () => {
    const shared = sharedFolder();
    const first = claimCommandCache(shared);
    const second = claimCommandCache(shared);
    expect(second.isShared).toBe(false);
    expect(second.folder).not.toBe(shared);
    mkdirSync(join(second.folder, "deps"), { recursive: true });
    second.release();
    expect(existsSync(second.folder)).toBe(false);
    expect(readFileSync(`${shared}.lock`, "utf8")).toBe(String(process.pid));
    first.release();
  });

  it("gives the shared folder back to the next server once the first closed", () => {
    const shared = sharedFolder();
    claimCommandCache(shared).release();
    const next = claimCommandCache(shared);
    expect(next.isShared).toBe(true);
    next.release();
  });

  it("takes over a lock whose process is gone, and removes the folders such a process left", () => {
    const shared = sharedFolder();
    const pid = endedPid();
    expect(isProcessRunning(pid)).toBe(false);
    mkdirSync(join(shared, ".."), { recursive: true });
    writeFileSync(`${shared}.lock`, String(pid));
    const left = join(shared, "..", `commands-own-${pid}-1`);
    mkdirSync(left);
    const claim = claimCommandCache(shared);
    expect(claim.isShared).toBe(true);
    expect(existsSync(left)).toBe(false);
    claim.release();
  });

  it("leaves a lock alone when it names no process yet", () => {
    const shared = sharedFolder();
    mkdirSync(join(shared, ".."), { recursive: true });
    writeFileSync(`${shared}.lock`, "");
    const claim = claimCommandCache(shared);
    expect(claim.isShared).toBe(false);
    claim.release();
    expect(readFileSync(`${shared}.lock`, "utf8")).toBe("");
  });

  it("takes over a lock that has named no process for longer than a write takes", () => {
    const shared = sharedFolder();
    mkdirSync(join(shared, ".."), { recursive: true });
    writeFileSync(`${shared}.lock`, "");
    const long = new Date(Date.now() - 60_000);
    utimesSync(`${shared}.lock`, long, long);
    const claim = claimCommandCache(shared);
    expect(claim.isShared).toBe(true);
    expect(existsSync(`${shared}.lock.take-over`)).toBe(false);
    claim.release();
  });

  it("runs apart while another process takes a stale lock over", () => {
    const shared = sharedFolder();
    mkdirSync(join(shared, ".."), { recursive: true });
    writeFileSync(`${shared}.lock`, String(endedPid()));
    writeFileSync(`${shared}.lock.take-over`, String(process.pid));
    const claim = claimCommandCache(shared);
    expect(claim.isShared).toBe(false);
    claim.release();
  });

  it("gives back only what it holds, once", () => {
    const shared = sharedFolder();
    const claim = claimCommandCache(shared);
    claim.release();
    const next = claimCommandCache(shared);
    claim.release();
    expect(readFileSync(`${shared}.lock`, "utf8")).toBe(String(process.pid));
    next.release();
  });
});
