/**
 * Paths as Vite writes its module ids: forward slashes on every system (`C:/app/src/x.tsx` on Windows), so a path the
 * plugin builds can be compared with an id Vite hands it, written into generated code, or used as a key that TypeScript's
 * file names (also forward slashes) meet. Exported as `forgebook/vite/paths`, so an adapter's plugin builds its paths
 * the same way, and its tests run the Windows logic anywhere (`vitePathsOf(path.win32)`).
 *
 * @remarks
 * Node's `path` writes Windows paths with backslashes (`C:\app\src\x.tsx`), and Vite's ids never have them: an id
 * compared with `join(dir, file)` does not match on Windows, so the plugin would not recognise its own modules and the
 * shell's entry would answer 404. Every path compared with an id, written into generated code or used as a key goes
 * through these; a path only shown to a person or handed to `fs` keeps Node's form.
 * `normalize` follows the rule of Vite's own `normalizePath` (backslashes to slashes on Windows, then POSIX
 * normalisation), so both write the same text; it is written here so a test can name the system (`path.win32`) and run
 * the Windows logic anywhere. On macOS and Linux a backslash is a legal character of a file name and stays. One
 * departure: a Windows network path keeps its two leading slashes (`//server/share`), where POSIX normalisation keeps
 * one, which Windows reads as a folder of the current drive. Paths are compared as written: a drive letter in another
 * case (`c:` and `C:`) names another path, as it does for Vite.
 *
 * @module
 */
import nodePath, { type PlatformPath, posix } from "node:path";

/** The functions of Node's `path` these build on: the running system's, or the one a test names (`path.win32`). */
export type PathSystem = Pick<
  PlatformPath,
  "sep" | "isAbsolute" | "resolve" | "relative" | "join" | "dirname"
>;

/** Node's path functions, each answering in Vite's form: forward slashes, normalised. */
export type VitePaths = {
  /** A path in Vite's form; an empty path stays empty. */
  readonly normalize: (path: string) => string;
  /** `path.resolve`, in Vite's form. */
  readonly resolve: (...segments: readonly string[]) => string;
  /** `path.join`, in Vite's form. */
  readonly join: (...segments: readonly string[]) => string;
  /** `path.dirname`, in Vite's form. */
  readonly dirname: (path: string) => string;
  /** `path.relative`, with forward slashes: empty when both name the same folder. */
  readonly relative: (from: string, to: string) => string;
  /**
   * A file's key in a folder (`./src/x.stories.tsx`, `../kit/x.stories.tsx`): its path from the folder, with forward
   * slashes, starting with a dot.
   */
  readonly relativeKey: (folder: string, file: string) => string;
  /** `path.isAbsolute` on the system: `C:\app` and `C:/app` on Windows, `/app` everywhere. */
  readonly isAbsolute: (path: string) => boolean;
  /** Whether two paths name the same file as written, whatever separators each uses. */
  readonly isSame: (first: string, second: string) => boolean;
};

/**
 * The path functions of a system, answering in Vite's form.
 *
 * @param system - the system's `path` (`path.win32`, `path.posix`, or the running system's `path`).
 */
export const vitePathsOf = (system: PathSystem): VitePaths => {
  const isWindows = system.sep === "\\";
  const normalize = (path: string): string => {
    if (path === "") return "";
    if (!isWindows) return posix.normalize(path);
    const slashed = path.replaceAll("\\", "/");
    const normalized = posix.normalize(slashed);
    return slashed.startsWith("//") && !normalized.startsWith("//") ? `/${normalized}` : normalized;
  };
  return {
    normalize,
    resolve: (...segments: readonly string[]): string => normalize(system.resolve(...segments)),
    join: (...segments: readonly string[]): string => normalize(system.join(...segments)),
    dirname: (path: string): string => normalize(system.dirname(path)),
    relative: (from: string, to: string): string => normalize(system.relative(from, to)),
    relativeKey: (folder: string, file: string): string => {
      const path = normalize(system.relative(folder, system.resolve(folder, file)));
      return path.startsWith(".") ? path : `./${path}`;
    },
    isAbsolute: (path: string): boolean => system.isAbsolute(path),
    isSame: (first: string, second: string): boolean => normalize(first) === normalize(second)
  };
};

/** The running system's path functions, in Vite's form: what the plugin, the commands and the tools use. */
export const VITE_PATHS: VitePaths = vitePathsOf(nodePath);
