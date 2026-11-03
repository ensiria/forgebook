/**
 * Storybook's preview hooks that read the story (`useArgs`, `useGlobals`, `useParameter`, `useStoryContext`), for a
 * React story file written for Storybook: its imports of `storybook/preview-api` reach these, and React's own for
 * Storybook's `useState`, `useEffect` and the rest (`vite/storybookPreviewApi.ts`).
 *
 * @remarks
 * Storybook runs its hooks on a state of its own, since it calls a decorator outside any framework's render. Forgebook
 * draws every decorator and render of a React story inside a component (`storyElement.ts`), so Storybook's hooks are
 * React's there, and a hook of each kind may be mixed in one decorator as Storybook's documentation asks not to. What
 * the story is drawn with comes from the decorator or render being called: `storyElement.ts` names it while it calls
 * one (`withStoryHooks`), as Storybook names its own, and on the global object so that a second copy of this module
 * (a pre-bundled one beside the sources) reads the same. `useArgs`'s update and reset change the story's args as the
 * panel would (`forgebook/renderer`'s `changeArgs`). Globals are the catalogue's switches, set from its toolbar: a
 * story cannot change them, and Storybook's channel does not exist here.
 *
 * @module
 */
import type { ArgsChange } from "forgebook/renderer";
import { useCallback } from "react";

/** What a story's decorators and render are drawn with, as Storybook's hooks read it. */
export type StoryHooksContext = {
  /** The story's id. */
  readonly id: string;
  /** The args it is drawn with. */
  readonly args: Readonly<Record<string, unknown>>;
  /** The values of the catalogue's switches, its `context.globals`. */
  readonly globals: Readonly<Record<string, string>>;
  /** Its parameters. */
  readonly parameters: Readonly<Record<string, unknown>>;
  /** The whole context its decorator or render was called with, for `useStoryContext`. */
  readonly context: Readonly<Record<string, unknown>>;
  /** Changes its args as the panel would; does nothing where nothing takes them (a server render). */
  readonly changeArgs: (change: ArgsChange) => void;
};

/** Where the context of the decorator or render being called is kept: one place, however many copies of the module. */
const CURRENT = Symbol.for("forgebook.react.storybook-hooks");

/** Whether a value is the context `withStoryHooks` keeps. */
const isStoryHooksContext = (value: unknown): value is StoryHooksContext =>
  typeof value === "object" &&
  value !== null &&
  typeof Reflect.get(value, "id") === "string" &&
  typeof Reflect.get(value, "changeArgs") === "function";

/**
 * Calls a story's decorator or render with the context Storybook's hooks read while it runs.
 *
 * @param context - what the story is drawn with.
 * @param call - the decorator's or render's call.
 * @returns what it returns.
 */
export const withStoryHooks = <TResult>(context: StoryHooksContext, call: () => TResult): TResult => {
  const outer: unknown = Reflect.get(globalThis, CURRENT);
  Reflect.set(globalThis, CURRENT, context);
  try {
    return call();
  } finally {
    Reflect.set(globalThis, CURRENT, outer);
  }
};

/**
 * The context of the decorator or render being called.
 *
 * @throws outside one, with the message Storybook gives.
 */
const currentContext = (): StoryHooksContext => {
  const current: unknown = Reflect.get(globalThis, CURRENT);
  if (!isStoryHooksContext(current))
    throw new Error("Storybook preview hooks can only be called inside decorators and story functions.");
  return current;
};

/**
 * The story's args, and how to change them, as the panel would: `updateArgs` sets values, `resetArgs` puts the named
 * ones (every one, with none named) back to the story's own.
 *
 * @returns the args, the update and the reset.
 */
export const useArgs = (): [
  Readonly<Record<string, unknown>>,
  (args: Readonly<Record<string, unknown>>) => void,
  (names?: readonly string[]) => void
] => {
  const { args, changeArgs } = currentContext();
  const updateArgs = useCallback(
    (set: Readonly<Record<string, unknown>>): void => changeArgs({ reset: [], set }),
    [changeArgs]
  );
  const resetArgs = useCallback(
    (names?: readonly string[]): void => changeArgs({ reset: names ?? "all", set: {} }),
    [changeArgs]
  );
  return [args, updateArgs, resetArgs];
};

/**
 * The values of the catalogue's switches, and Storybook's way to change them, which throws: they are set from the
 * catalogue's toolbar.
 *
 * @returns the values and the change.
 */
export const useGlobals = (): [Readonly<Record<string, string>>, (globals: unknown) => never] => {
  const { globals } = currentContext();
  const updateGlobals = useCallback((): never => {
    throw new Error("A story cannot change Forgebook's switches: they are set from the catalogue's toolbar");
  }, []);
  return [globals, updateGlobals];
};

/**
 * One of the story's parameters.
 *
 * @param key - the parameter's name.
 * @param defaultValue - what to give when the story has none.
 */
export const useParameter = <TValue>(key: string, defaultValue?: TValue): unknown =>
  currentContext().parameters[key] ?? defaultValue;

/**
 * The context the decorator or render was called with.
 *
 * @returns the context.
 */
export const useStoryContext = (): Readonly<Record<string, unknown>> => currentContext().context;

/**
 * Storybook's channel to its addons, which Forgebook does not have.
 *
 * @throws always, saying so.
 */
export const useChannel = (): never => {
  throw new Error(
    "Storybook's channel does not exist in Forgebook: a story cannot talk to Storybook's addons"
  );
};
