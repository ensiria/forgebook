/**
 * A static server for a tool's build, that also knows each file's gzipped size.
 *
 * @remarks
 * The sizes are computed from the files and not read from the network, since a test server's choices (compression
 * level, chunked responses) would become part of the number. Level 9, as a static host serves.
 *
 * @module
 */
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { gzipSync } from "node:zlib";

/** What a browser needs to be told, by extension. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".map": "application/json"
};

/** A running server. */
export type StaticServer = {
  /** Its address, ending in `/`. */
  readonly base: string;
  /** Stops it. */
  readonly close: () => Promise<void>;
  /** The gzipped size of a file of the folder, by its path in an address. @throws when there is no such file. */
  readonly gzippedSize: (path: string) => number;
};

/**
 * Serves a folder.
 *
 * @param root - the folder.
 * @param host - the address to listen on.
 * @param port - the port.
 */
export const serveStatic = (root: string, host: string, port: number): Promise<StaticServer> => {
  const fileOf = (path: string): string => join(root, normalize(decodeURIComponent(path)));
  const server: Server = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://localhost");
    const file = fileOf(pathname === "/" ? "/index.html" : pathname);
    readFile(file).then(
      (body) => {
        response.writeHead(200, {
          "content-type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream"
        });
        response.end(body);
      },
      () => {
        response.writeHead(404);
        response.end();
      }
    );
  });
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      resolve({
        base: `http://${host}:${port}/`,
        gzippedSize: (path) => gzipSync(readFileSync(fileOf(path)), { level: 9 }).length,
        close: () =>
          new Promise((done) => {
            server.closeAllConnections();
            server.close(() => done());
          })
      });
    });
  });
};
