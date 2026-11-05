/**
 * Requests written by hand for a real dev server, with the headers a browser or a tool would send: `fetch` normalises a
 * `..` away and cannot set `Host`, `Origin` or `Sec-Fetch-*`.
 *
 * @module
 */
import { request } from "node:http";

import type { ViteDevServer } from "vite";

/** The headers of a module script the catalogue's own page imports. */
export const OWN_SCRIPT = {
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "script"
};

/** The headers of a tool's request Vite answers as a module: a tool may send anything but a browser's facts. */
export const TOOL_SCRIPT = { "sec-fetch-dest": "script" };

/** A response. */
export type Answer = {
  /** Its status. */
  readonly status: number;
  /** Its body. */
  readonly body: string;
  /** Where it sends the client, when it does. */
  readonly location: string | undefined;
};

/**
 * Sends one request as written.
 *
 * @param port - the port.
 * @param path - the address, sent as it is.
 * @param headers - its headers.
 */
export const ask = (port: number, path: string, headers: Record<string, string> = {}): Promise<Answer> =>
  new Promise((resolve, reject) => {
    const sent = request({ host: "127.0.0.1", port, path, headers }, (response) => {
      let body = "";
      response.on("data", (chunk: Buffer): void => {
        body += chunk.toString();
      });
      response.on("end", (): void =>
        resolve({ status: response.statusCode ?? 0, body, location: response.headers.location })
      );
    });
    sent.on("error", reject);
    sent.end();
  });

/**
 * The address Vite serves a file under: `/@fs/C:/x` on Windows, `/@fs/x` elsewhere.
 *
 * @param file - the file, absolute in Vite's form.
 */
export const fsAddress = (file: string): string => `/@fs/${file.replace(/^\//, "")}`;

/**
 * Starts a server on any free port. Vite finds one and then binds it, so another test's server can take it in between.
 *
 * @param server - the server, told port 0.
 * @param triesLeft - how many more times to try.
 */
export const listenOnFreePort = async (server: ViteDevServer, triesLeft = 5): Promise<void> => {
  try {
    await server.listen();
  } catch (error) {
    if (triesLeft === 0 || !(error instanceof Error) || !error.message.includes("already in use"))
      throw error;
    await listenOnFreePort(server, triesLeft - 1);
  }
};

/**
 * The port a listening server took.
 *
 * @param server - the server.
 */
export const portOf = (server: ViteDevServer): number => {
  const address = server.httpServer?.address();
  if (address === null || address === undefined || typeof address === "string")
    throw new Error("The server does not listen");
  return address.port;
};
