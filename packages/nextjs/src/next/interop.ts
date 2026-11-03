/**
 * The default export of one of Next.js's CommonJS modules, as Next.js's compiler reads it.
 *
 * @remarks
 * Next.js's modules are CommonJS marked `__esModule`: Next.js's compiler takes their `exports.default` for a default
 * import, while Vite takes the whole `exports` object, as Node does. The stand-ins that keep Next.js's own component
 * (`next/image`, `next/script`) read it through this, so the component a story gets is the one the app gets.
 *
 * @module
 */

/**
 * A module's default export: its `default` when the bundler gave the whole CommonJS `exports`, else the module itself.
 *
 * @param loaded - what the default import gave.
 * @param isExpected - whether a value is what the default export should be.
 * @param name - the module, for the error when it is neither.
 */
export const defaultExport = <TValue>(
  loaded: unknown,
  isExpected: (value: unknown) => value is TValue,
  name: string
): TValue => {
  if (isExpected(loaded)) return loaded;
  const inner: unknown =
    typeof loaded === "object" && loaded !== null ? Reflect.get(loaded, "default") : undefined;
  if (isExpected(inner)) return inner;
  throw new Error(
    `${name} has no default export Forgebook can read: the installed next may be a version it does not support`
  );
};

/**
 * Whether a value is a React component: a function, or what `forwardRef` and `memo` make.
 *
 * @param value - the value.
 */
export const isComponentLike = (value: unknown): boolean =>
  typeof value === "function" || (typeof value === "object" && value !== null && "$$typeof" in value);
