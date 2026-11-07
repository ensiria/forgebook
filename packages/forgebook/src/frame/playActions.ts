/**
 * A play's actions, one by one: what the play did through the `canvas` and the `userEvent` its context hands it, for
 * the Interactions tab's log and its step debugger.
 *
 * @remarks
 * The tools are wrapped, not the library: the story is what is shown, and what a play imports itself
 * (`@testing-library/user-event`, `storybook/test`) is another object, so it runs unrecorded. A sync query must stay sync,
 * so only what already returns a promise (a `findBy…`, a user's action, a `step`) can wait for "next"; a `getBy…` is only
 * logged. A wrapped action behaves as the tool does, its result and its throw included.
 *
 * @module
 */
import type { PlayAction } from "../playTrace.ts";
import { previewValue } from "./callValues.ts";

/** What the wrapped tools report to. */
export type ActionRecorder = {
  /** Waits until the play may go on past an action, by its text; at once unless the play is being stepped through. */
  readonly gate: (label: string) => Promise<void>;
  /** Adds an action to the log; its index. */
  readonly begin: (label: string) => number;
  /** Ends an action in the log. */
  readonly end: (index: number, action: PlayAction) => void;
};

/** Milliseconds since an instant, rounded. */
const since = (start: number): number => Math.round(performance.now() - start);

/** The most characters of a call the log keeps. */
const LABEL_LENGTH = 200;

/** The most characters of an error the log keeps: a failed query's message holds the whole document. */
const ERROR_LENGTH = 300;

/** An error's message, cut to what a line of the log holds. */
const messageOf = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, ERROR_LENGTH);

/**
 * An argument as the log shows it: an element by its tag and its name, the rest as the Events tab shows them.
 *
 * @param value - the argument.
 */
const argText = (value: unknown): string => {
  if (typeof Element !== "undefined" && value instanceof Element) {
    const name = (value.getAttribute("aria-label") ?? value.textContent?.trim() ?? "").slice(0, 30);
    return name === "" ? `<${value.localName}>` : `<${value.localName}> "${name}"`;
  }
  return value instanceof RegExp ? String(value) : previewValue(value);
};

/** The text of a call. */
const callText = (name: string, args: readonly unknown[]): string =>
  `${name}(${args.map(argText).join(", ")})`.slice(0, LABEL_LENGTH);

/**
 * A tool's async function, logged and held at the gate.
 *
 * @param label - the function's name in the log.
 * @param run - calls the function.
 * @param recorder - what it reports to.
 */
const heldCall = async (label: string, run: () => unknown, recorder: ActionRecorder): Promise<unknown> => {
  await recorder.gate(label);
  const index = recorder.begin(label);
  const start = performance.now();
  try {
    const result = await run();
    recorder.end(index, { label, status: "passed", ms: since(start) });
    return result;
  } catch (error) {
    recorder.end(index, { label, status: "failed", ms: since(start), error: messageOf(error) });
    throw error;
  }
};

/**
 * A tool's sync function, logged.
 *
 * @param label - the function's name in the log.
 * @param run - calls the function.
 * @param recorder - what it reports to.
 */
const loggedCall = (label: string, run: () => unknown, recorder: ActionRecorder): unknown => {
  const index = recorder.begin(label);
  try {
    const result = run();
    recorder.end(index, { label, status: "passed", ms: 0 });
    return result;
  } catch (error) {
    recorder.end(index, { label, status: "failed", ms: 0, error: messageOf(error) });
    throw error;
  }
};

/**
 * A tool whose functions log themselves.
 *
 * @param tool - the tool (`canvas`, `userEvent`); anything else stays as it is.
 * @param name - its name in the log.
 * @param recorder - what it reports to.
 * @param isSync - whether a function of it returns at once: logged, never held.
 */
export const recordedTool = (
  tool: unknown,
  name: string,
  recorder: ActionRecorder,
  isSync: (member: string) => boolean
): unknown => {
  if (typeof tool !== "object" || tool === null) return tool;
  return new Proxy(tool, {
    get: (target: object, key: string | symbol): unknown => {
      const member: unknown = Reflect.get(target, key);
      if (typeof member !== "function" || typeof key !== "string") return member;
      return (...args: unknown[]): unknown => {
        const label = callText(`${name}.${key}`, args);
        const run = (): unknown => Reflect.apply(member, target, args);
        // `userEvent.setup()` hands back the instance the rest of the play uses
        if (key === "setup") return recordedTool(run(), name, recorder, isSync);
        return isSync(key) ? loggedCall(label, run, recorder) : heldCall(label, run, recorder);
      };
    }
  });
};

/**
 * Whether a query of Testing Library returns at once: all but `findBy…` and `findAllBy…`.
 *
 * @param member - the query's name.
 */
export const isSyncQuery = (member: string): boolean => !member.startsWith("find");

/** Whether a member of `userEvent` returns at once: none of them does, but for its `setup`. */
export const isSyncEvent = (): boolean => false;
