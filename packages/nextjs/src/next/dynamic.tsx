/**
 * `next/dynamic` in a catalogue: a component loaded when it is first drawn, its `loading` shown meanwhile.
 *
 * @remarks
 * Next.js's own `dynamic` is shaped by its compiler (a module id written into each call); in Vite a dynamic import is
 * already split, so `React.lazy` does the work. Without a `loading` component the story's own boundary waits for the
 * module, and the story counts as drawn only once it came (`nextFrameRenderer.tsx`), so a test or a screenshot never catches
 * the empty moment; with one, the loading state shows first, as in the app. `ssr: false` changes nothing: a story is
 * drawn in the browser.
 *
 * @module
 */
import { type ComponentType, lazy, type ReactNode, Suspense } from "react";

/** What a loader gives: the component, or a module whose default export it is. */
type Loaded<TProps> = ComponentType<TProps> | { readonly default: ComponentType<TProps> };

/** A loader: a function returning the import, or the import itself. */
type Loader<TProps> = (() => Promise<Loaded<TProps>>) | Promise<Loaded<TProps>>;

/** What the `loading` component receives. */
export type DynamicLoadingProps = {
  /** The error the import failed with, if it did. */
  readonly error?: Error | null;
  /** Whether it is still loading. */
  readonly isLoading?: boolean;
  /** Whether the delay before showing the loading state passed: always, in a story. */
  readonly pastDelay?: boolean;
  /** Whether it took too long: never, in a story. */
  readonly timedOut?: boolean;
};

/** The options of `dynamic`. */
export type DynamicOptions<TProps> = {
  /** What is drawn while the component loads. */
  readonly loading?: (props: DynamicLoadingProps) => ReactNode;
  /** Whether the server renders it: no effect in a story. */
  readonly ssr?: boolean;
  /** The loader, when the options are the only argument. */
  readonly loader?: Loader<TProps>;
};

/** Whether what a loader gave is a module with a default export rather than the component. */
const isModule = <TProps,>(loaded: Loaded<TProps>): loaded is { readonly default: ComponentType<TProps> } =>
  typeof loaded === "object" && "default" in loaded;

/**
 * Next.js's `dynamic`.
 *
 * @param loader - the loader, or the options with their `loader`.
 * @param options - the options.
 * @returns the component, loaded when first drawn.
 */
const dynamic = <TProps extends object>(
  loader: Loader<TProps> | DynamicOptions<TProps>,
  options: DynamicOptions<TProps> = {}
): ComponentType<TProps> => {
  const isOptions = typeof loader === "object" && !(loader instanceof Promise);
  const settings: DynamicOptions<TProps> = isOptions ? { ...loader, ...options } : options;
  const load = isOptions ? settings.loader : loader;
  const Lazy = lazy(async (): Promise<{ default: ComponentType<TProps> }> => {
    if (load === undefined) throw new Error("next/dynamic was given no loader");
    const loaded = await (typeof load === "function" ? load() : load);
    return { default: isModule(loaded) ? loaded.default : loaded };
  });
  const { loading } = settings;
  // biome-ignore lint/correctness/noComponentHookFactories: next/dynamic's API makes a component per call, which the app calls once, at the top of its module
  const Dynamic = (props: TProps): ReactNode =>
    loading === undefined ? (
      <Lazy {...props} />
    ) : (
      <Suspense fallback={loading({ error: null, isLoading: true, pastDelay: true, timedOut: false })}>
        <Lazy {...props} />
      </Suspense>
    );
  return Dynamic;
};

export default dynamic;
