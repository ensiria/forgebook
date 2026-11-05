/**
 * A promise given a deadline: for the waits of the benchmark that have none of their own.
 *
 * @remarks
 * Playwright's `evaluate` waits for as long as a page's script takes, and a page whose main thread is stuck (a story's
 * endless loop, a frame's process that stopped answering) never answers: a measurement that asks it something would
 * wait forever, and the whole run with it, without a word. The work given a deadline goes on in the background; only
 * the wait for it ends.
 *
 * @module
 */

/**
 * Waits for a promise, for at most a while.
 *
 * @param work - what is waited for.
 * @param timeoutMs - how long, in milliseconds.
 * @param what - what it is, for the error.
 * @returns what the work gave.
 * @throws when the deadline comes first, naming the work, or what the work threw.
 */
export const withDeadline = async <TResult>(
  work: Promise<TResult>,
  timeoutMs: number,
  what: string
): Promise<TResult> => {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} took longer than ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
};
