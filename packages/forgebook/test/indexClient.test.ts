/**
 * Tests for reading a built catalogue from an address, which is not trusted: a page that is no index, an endless answer.
 *
 * @module
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { indexClient } from "../bin/forgebook/agentClient.ts";

let server: Server | undefined;

/** Serves one handler, and gives its address. */
const served = async (handler: Parameters<typeof createServer>[1]): Promise<string> => {
  const started = createServer(handler);
  server = started;
  await new Promise<void>((resolve) => started.listen(0, "127.0.0.1", resolve));
  const address = started.address();
  if (typeof address !== "object" || address === null) throw new Error("No address");
  return `HTTP://127.0.0.1:${(address satisfies AddressInfo).port}`;
};

afterEach(() => {
  server?.closeAllConnections();
  server?.close();
});

describe("indexClient", () => {
  it("takes a host's fallback page for no index, in any case of scheme", async () => {
    const address = await served((_request, response) => response.end("<!doctype html><html></html>"));
    await expect(indexClient(address)).rejects.toThrow("holds no index");
  });

  it("stops reading an answer over the largest index", async () => {
    const part = Buffer.alloc(1024 * 1024);
    const address = await served((_request, response) => {
      const write = (): void => {
        while (response.write(part)) if (response.destroyed) return;
        response.once("drain", write);
      };
      write();
    });
    await expect(indexClient(address)).rejects.toThrow("is over");
  }, 30_000);
});
