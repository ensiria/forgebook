/**
 * A project's components, read from disk and kept by each file's size and time, so a running dev server that is asked again
 * reads only what changed.
 *
 * @remarks
 * Every `check-code` reads the whole repository, and a long-lived server is asked often. Only components are kept, not
 * files' text, since a repository's text is more than a server should hold.
 *
 * @module
 */
import { statSync } from "node:fs";
import { dirname, join } from "node:path";

import { repositoryOf, smallFileText } from "./appTokenFiles.ts";
import { LEFT_ALONE } from "./checkCode.ts";
import { rulesOfFile } from "./componentRules.ts";
import { COMPONENT_FILE, projectComponents, type ScannedComponent } from "./componentScan.ts";
import { listedProjectFiles, MOST_BYTES } from "./projectFiles.ts";
import { isInside } from "./sourceTokens.ts";

/** A file's components, with what they were read at. */
type Kept = {
  readonly stamp: string;
  readonly components: readonly ScannedComponent[];
};

/** What has been read, by absolute path. */
const KEPT = new Map<string, Kept>();

/**
 * A file's components with what a rules file beside it says of them, by the file's name or the component's (`radio-group.tsx`
 * may have `RadioGroup.rules.json`). Read each time: it is short and rare.
 */
const withRulesBeside = (
  components: readonly ScannedComponent[],
  path: string,
  root: string
): readonly ScannedComponent[] =>
  components.map((each) => {
    const names = [path.replace(/\.[^./\\]+$/, ""), join(dirname(path), each.name)];
    const own = names
      .map((name) => `${name}.rules.json`)
      // a link beside a component may lead anywhere
      .flatMap((name) => (isInside(root, name) ? (smallFileText(name) ?? []) : []))
      .map((text) => rulesOfFile(text).get(each.name))
      .find((rules) => rules !== undefined);
    return own === undefined ? each : { ...each, rules: { ...each.rules, ...own } };
  });

/**
 * Every component of a project as its files are now.
 *
 * @param dir - its folder.
 * @param notes - told of what is left out.
 */
export const currentComponents = (dir: string, notes: string[]): ScannedComponent[] => {
  let bytes = 0;
  const root = repositoryOf(dir);
  return listedProjectFiles(dir, notes)
    .filter((file) => COMPONENT_FILE.test(file) && !LEFT_ALONE.test(file))
    .flatMap((file): readonly ScannedComponent[] => {
      const path = join(dir, file);
      try {
        const { size, mtimeMs } = statSync(path);
        const stamp = `${size}:${mtimeMs}`;
        const known = KEPT.get(path);
        if (known?.stamp === stamp) return withRulesBeside(known.components, path, root);
        if (bytes > MOST_BYTES) return [];
        bytes += size;
        const text = smallFileText(path);
        const components = text === undefined ? [] : projectComponents([{ file, text }]);
        KEPT.set(path, { stamp, components });
        return withRulesBeside(components, path, root);
      } catch {
        return [];
      }
    });
};
