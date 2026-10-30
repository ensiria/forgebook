/**
 * Tests for the frame's retry on a stale module: which messages count, one retry per address, and no retry without
 * a storage.
 *
 * @module
 */
import { describe, expect, it } from "vitest";

import { clearRetry, isStaleModuleError, markRetry } from "../src/frame/staleModule";

/** A session storage in memory. */
const memoryStorage = (): Storage => {
  const items = new Map<string, string>();
  return {
    get length(): number {
      return items.size;
    },
    clear: (): void => items.clear(),
    getItem: (key: string): string | null => items.get(key) ?? null,
    key: (index: number): string | null => [...items.keys()][index] ?? null,
    removeItem: (key: string): void => {
      items.delete(key);
    },
    setItem: (key: string, value: string): void => {
      items.set(key, value);
    }
  };
};

describe("isStaleModuleError", () => {
  it("recognises each engine's wording, and nothing else", () => {
    expect(isStaleModuleError("Failed to fetch dynamically imported module: http://x/a.tsx")).toBe(true);
    expect(isStaleModuleError("error loading dynamically imported module: http://x/a.tsx")).toBe(true);
    expect(isStaleModuleError("Importing a module script failed.")).toBe(true);
    expect(isStaleModuleError('No story "a--b"')).toBe(false);
  });
});

describe("markRetry and clearRetry", () => {
  it("retries an address once, again after its story rendered", () => {
    const storage = memoryStorage();
    expect(markRetry(storage, "frame.html?story=a")).toBe(true);
    expect(markRetry(storage, "frame.html?story=a")).toBe(false);
    expect(markRetry(storage, "frame.html?story=b")).toBe(true);
    clearRetry(storage, "frame.html?story=a");
    expect(markRetry(storage, "frame.html?story=a")).toBe(true);
  });

  it("never retries without a storage, or when it refuses access", () => {
    const refusing = {
      ...memoryStorage(),
      getItem: (): string | null => {
        throw new Error("blocked");
      }
    };
    expect(markRetry(undefined, "frame.html?story=a")).toBe(false);
    expect(markRetry(refusing, "frame.html?story=a")).toBe(false);
  });
});
