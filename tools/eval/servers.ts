/**
 * The dev servers a measurement needs, the app's and Forgebook's: started in a process group of their own, waited for
 * until they answer, and stopped with everything they started.
 *
 * @module
 */
import { type ChildProcess, spawn } from "node:child_process";
import { connect } from "node:net";

import { hasEnded, isOwnGroup, killTree, STOP_TIMEOUT, waitForExit } from "../bench/processTree.ts";
import { invocation } from "../bench/programs.ts";
import { withOpenFiles } from "./openFiles.ts";

/** How long a server may take to answer, in milliseconds: a first start pre-bundles its dependencies. */
const START_TIMEOUT = 180_000;

/** How long between two tries, in milliseconds. */
const POLL_INTERVAL = 500;

/** How much of a server's output is kept, for the error when it dies, in characters. */
const KEPT_OUTPUT = 4000;

/** A server started. */
export type Server = {
  /** Its process. */
  readonly child: ChildProcess;
  /** The end of what it printed. */
  readonly output: () => string;
};

/**
 * Whether something already listens on a port of this machine.
 *
 * @param port - the port.
 */
export const isPortTaken = (port: number): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = connect({ host: "localhost", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });

/**
 * Starts a server.
 *
 * @param command - the program and its arguments.
 * @param cwd - its folder.
 * @param env - its whole environment.
 */
export const startServer = (
  command: readonly string[],
  cwd: string,
  env: Readonly<Record<string, string>>
): Server => {
  const [program, ...args] = command;
  if (program === undefined) throw new Error("the server's command is empty");
  const resolved = withOpenFiles(invocation(program, args, { cwd, env }));
  const child = spawn(resolved.program, [...resolved.args], {
    cwd,
    env,
    detached: isOwnGroup,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let kept = "";
  const keep = (chunk: Buffer): void => {
    kept = `${kept}${chunk.toString()}`.slice(-KEPT_OUTPUT);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  child.once("error", (error) => keep(Buffer.from(String(error))));
  return { child, output: () => kept };
};

/**
 * Waits until a server answers an address with success; one that dies fails at once.
 *
 * @param server - the server.
 * @param address - the address.
 * @throws when it dies or does not answer in time.
 */
export const waitForAnswer = async (server: Server, address: string): Promise<void> => {
  const deadline = Date.now() + START_TIMEOUT;
  while (Date.now() < deadline) {
    if (hasEnded(server.child)) throw new Error(`the server stopped: ${server.output()}`);
    const isOk = await fetch(address, { signal: AbortSignal.timeout(10_000) }).then(
      async (response) => {
        await response.body?.cancel();
        return response.ok;
      },
      () => false
    );
    if (isOk) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
  throw new Error(`nothing answered at ${address}: ${server.output()}`);
};

/**
 * Stops a server and what it started, and waits for it to be gone, for a while only.
 *
 * @param server - the server.
 */
export const stopServer = async (server: Server): Promise<void> => {
  if (server.child.pid === undefined) return;
  // its group, even when it ended itself: what it started may outlive it
  await killTree(server.child.pid);
  await waitForExit(server.child, STOP_TIMEOUT);
};
