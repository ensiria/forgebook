/**
 * Tests for the dev plugin that strips a file's types before Fast Refresh reads it: a component cast after
 * `forwardRef` is registered, and a file without such a cast is left alone.
 *
 * @module
 */
import { transformWithOxc } from "vite";
import { describe, expect, it } from "vitest";

import { refreshThroughCasts } from "../src/vite/refreshThroughCasts.ts";

/** A component kept generic through `forwardRef` by a cast, as React Spectrum writes its button. */
const CAST = [
  'import { forwardRef } from "react";',
  "export const Button = forwardRef(function Button<T>(props: { label: T }, ref) {",
  "  return <button ref={ref}>{String(props.label)}</button>;",
  "}) as <T>(props: { label: T }) => null;"
].join("\n");

/** What the plugin answers for a file. */
const transformed = async (code: string, id: string): Promise<string | undefined> => {
  const { transform } = refreshThroughCasts();
  if (typeof transform !== "object") throw new Error("missing hook");
  const answer: unknown = await transform.handler.call(undefined as never, code, id);
  return typeof answer === "object" && answer !== null && "code" in answer ? String(answer.code) : undefined;
};

/** Whether Vite's transformer registers a component of the code for Fast Refresh. */
const isRegistered = async (code: string): Promise<boolean> => {
  const out = await transformWithOxc(code, "/kit/Button.tsx", {
    lang: "tsx",
    jsx: { runtime: "automatic", development: true, refresh: true }
  });
  return out.code.includes("$RefreshReg$(_c");
};

describe("refreshThroughCasts", () => {
  it("strips the types of a component cast after forwardRef, so Fast Refresh registers it", async () => {
    expect(await isRegistered(CAST)).toBe(false);
    const stripped = await transformed(CAST, "/kit/Button.tsx");
    expect(stripped).toBeDefined();
    expect(stripped).toContain("<button ref={ref}>");
    expect(await isRegistered(stripped ?? "")).toBe(true);
  });

  it("leaves a file without a cast after a call to React's own transform", async () => {
    expect(
      await transformed(CAST.replace(") as <T>(props: { label: T }) => null;", ");"), "/kit/B.tsx")
    ).toBe(undefined);
  });
});
