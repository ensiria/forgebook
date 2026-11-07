/**
 * What a change adds against the components a project already has: imports of what is deprecated or replaced, and new
 * components that look like one that exists. Props are left to the type checker, which catches them where this cannot.
 *
 * @remarks
 * Pure. It reads only what the change adds, as the rest of `check-code` does. A component's own words decide what is
 * deprecated (`@deprecated`, `@replacedBy`). What fails has to be sure: a new exported component fails as a copy under any
 * name, with the same name and two signs of being the same thing, or rebuilding a plain element a component of its name
 * exists for. One sign is said as `advice`, as is what `@useWhen` and `@avoidWhen` say of a component just imported, since
 * only a reader can weigh them. It compares only what the file could use: its package and those its package depends on.
 *
 * @module
 */
import type { AddedLine, CodeProblem, ExcusedValue } from "./checkCode.ts";
import { type ScannedComponent, scannedComponents } from "./componentScan.ts";
import { importsOfFile, type WrittenImport } from "./fileImports.ts";
import { isBuiltOn, isRebuilt, isShareable, SAME_CODE, signsBetween, stemOf } from "./lookAlikes.ts";
import type { ProjectFile, WorkspacePackage } from "./projectFiles.ts";

/** Something to weigh, which fails nothing. */
export type ReuseAdvice = {
  /** The file, relative to the repository. */
  readonly file: string;
  /** The line in it. */
  readonly line: number;
  /** What to weigh, in a sentence. */
  readonly message: string;
};

/** What the reuse check found. */
export type ReuseFindings = {
  /** What fails. */
  readonly problems: readonly CodeProblem[];
  /** What to weigh. */
  readonly advice: readonly ReuseAdvice[];
  /** New components a comment says are meant. */
  readonly excused: readonly ExcusedValue[];
};

/** What the reuse check reads. */
export type ReuseInput = {
  /** The lines the change adds, with paths from the repository. */
  readonly added: readonly AddedLine[];
  /** The changed files that can hold components, as they are now. */
  readonly changed: readonly ProjectFile[];
  /** The same as they were, and those the change deleted. */
  readonly previous: readonly ProjectFile[];
  /** Every component of the project as it is now. */
  readonly components: readonly ScannedComponent[];
  /** The repository's packages. */
  readonly packages: readonly WorkspacePackage[];
};

/** What says a new component is meant: its rule and why, in a comment. */
const IGNORE_DUPLICATE = /(?:\/\/|\/\*|<!--)\s*forgebook-ignore\s+duplicate-component\s*:\s*([^*\n]{3,120})/;

/** How far above a component its comment may stand, past its own documentation. */
const IGNORE_REACH = 20;

/** A name a fix may give: an agent may act on it, and a tag holds any text. */
const COMPONENT_NAME = /^[A-Za-z_$][\w$.]{0,80}$/;

/** How many things to weigh an answer gives. */
const MOST_ADVICE = 20;

/** How much of a tag's text an answer repeats. */
const LONGEST_WORDS = 200;

/** What a package name's module part is. */
const PACKAGE_NAME = /^(@[^/]+\/[^/]+|[^@./][^/]*)(?:\/(.*))?$/;

/** A file's extension and a folder's index, which an import may leave out or write. */
const modulePath = (file: string): string =>
  file.replace(/\.(?:[cm]?[jt]sx?|vue|svelte|astro)$/, "").replace(/\/index$/, "");

/** A relative module's path from the repository. */
const relativeTarget = (from: string, module: string): string => {
  const parts = from.split("/").slice(0, -1);
  for (const part of module.split("/")) {
    if (part === "..") parts.pop();
    else if (part !== ".") parts.push(part);
  }
  return parts.join("/");
};

/** The folders of a file, nearest first, the repository last. */
const foldersOf = (file: string): string[] => {
  const parts = file.split("/").slice(0, -1);
  return [...parts.keys(), parts.length].map((count) => parts.slice(0, count).join("/")).toReversed();
};

/**
 * What an import may mean in the project's paths. An alias's folder is not known, but it is one this file sits under, so
 * another application's file of that path is not it; a package's name is the one its manifest says, so a third party's of
 * a similar path is not it either.
 */
const targetsOf = (
  from: string,
  module: string,
  packages: readonly WorkspacePackage[]
): readonly string[] => {
  const written = modulePath(module);
  if (written.startsWith(".")) return [relativeTarget(from, written)];
  if (/^[@~#]\//.test(written)) {
    const rest = written.slice(2);
    return foldersOf(from).map((folder) => (folder === "" ? rest : `${folder}/${rest}`));
  }
  const [, name = "", rest = ""] = PACKAGE_NAME.exec(written) ?? [];
  const found = packages.find((each) => each.name === name && each.name !== "");
  if (found === undefined) return [];
  const inside = (folder: string): string =>
    [found.dir, folder, rest].filter((part) => part !== "").join("/");
  return [inside(""), inside("src")];
};

/** Whether a component is what an import of a name means. */
const isImported = (component: ScannedComponent, name: string, targets: readonly string[]): boolean => {
  const path = modulePath(component.file);
  if (targets.includes(path))
    return name === "default" ? component.isDefault === true : component.name === name;
  // through a folder's index the file is another; the name has to be that folder's own
  return name === component.name && targets.some((target) => target !== "" && path.startsWith(`${target}/`));
};

/** A tag's text as an answer repeats it. */
const capped = (text: string): string => {
  const plain = text.replaceAll(/\p{Cc}/gu, " ");
  return plain.length > LONGEST_WORDS ? `${plain.slice(0, LONGEST_WORDS)}…` : plain;
};

/** What an imported component's own words make of importing it. */
const wordsOnImport = (file: string, line: number, { name, guidance }: ScannedComponent): ReuseFindings => {
  const { deprecated, replacedBy, useWhen, avoidWhen } = guidance ?? {};
  if (deprecated !== undefined || replacedBy !== undefined) {
    const why = deprecated === undefined ? "" : `: ${deprecated}`;
    const use = replacedBy === undefined ? "" : ` Use ${replacedBy}.`;
    return {
      problems: [
        {
          rule: "deprecated-component",
          file,
          line,
          value: name,
          ...(replacedBy !== undefined && COMPONENT_NAME.test(replacedBy) ? { fix: replacedBy } : {}),
          message: `${name} is deprecated${capped(why)}${capped(use)}`
        }
      ],
      advice: [],
      excused: []
    };
  }
  const parts = [
    ...(useWhen === undefined ? [] : [`use when ${useWhen.join("; ")}`]),
    ...(avoidWhen === undefined ? [] : [`avoid when ${avoidWhen.join("; ")}`])
  ];
  return {
    problems: [],
    advice: parts.length === 0 ? [] : [{ file, line, message: `${name}: ${capped(parts.join("; "))}.` }],
    excused: []
  };
};

/** What fails and what to weigh in one import the change adds, of the names it did not import before. */
const importFindings = (
  file: string,
  { names, module, lines }: WrittenImport,
  isOld: (name: string) => boolean,
  { components, packages }: Pick<ReuseInput, "components" | "packages">
): ReuseFindings => {
  const targets = targetsOf(file, module, packages);
  const found = names
    .filter((name) => !isOld(name))
    .flatMap((name) => {
      const matches = components.filter(
        (each) => each.file !== file && each.guidance !== undefined && isImported(each, name, targets)
      );
      // two of a name through one folder could be either
      return matches.length === 1 ? matches : [];
    })
    .map((each) => wordsOnImport(file, lines[0], each));
  return {
    problems: found.flatMap((each) => each.problems),
    advice: found.flatMap((each) => each.advice),
    excused: []
  };
};

/** Where an existing component is, and when to use it. */
const existingWords = ({ name, file, line, guidance }: ScannedComponent): string => {
  const when = guidance?.useWhen === undefined ? "" : ` (use when ${capped(guidance.useWhen.join("; "))})`;
  return `${name} in ${file}:${line}${when}`;
};

/** The existing component a new one is surely the same as, with why: a copy under any name, or the same name and signs. */
const sureMatch = (
  added: ScannedComponent,
  existing: readonly ScannedComponent[],
  alike: readonly { readonly other: ScannedComponent; readonly signs: readonly string[] }[]
): { readonly other: ScannedComponent; readonly why: string } | undefined => {
  const copied =
    added.code === undefined
      ? undefined
      : existing.find((other) => other.file !== added.file && other.code === added.code);
  if (copied !== undefined) return { other: copied, why: SAME_CODE };
  const sure = alike.find(({ signs }) => signs.length >= 2);
  if (sure !== undefined) return { other: sure.other, why: sure.signs.join(", ") };
  const [first] = alike;
  return first !== undefined && isRebuilt(added, stemOf(added.name))
    ? { other: first.other, why: `it renders a plain ${added.root ?? ""} of its own` }
    : undefined;
};

/** What a new component is against those that exist. */
const newComponentFindings = (
  added: ScannedComponent,
  existing: readonly ScannedComponent[]
): ReuseFindings => {
  const stem = stemOf(added.name);
  const isRebuilding = isRebuilt(added, stem);
  const alike = existing.flatMap((other) => {
    if (other.file === added.file || isBuiltOn(added, other) || stemOf(other.name) !== stem) return [];
    const signs = signsBetween(added, other);
    return signs.length === 0 && !isRebuilding ? [] : [{ other, signs }];
  });
  const sure = sureMatch(added, existing, alike);
  const { name, file, line } = added;
  if (sure !== undefined) {
    return {
      problems: [
        {
          rule: "duplicate-component",
          file,
          line,
          value: name,
          fix: sure.other.name,
          message: `${name} looks like ${existingWords(sure.other)}: ${sure.why}. Use it, or say why not.`
        }
      ],
      advice: [],
      excused: []
    };
  }
  return {
    problems: [],
    excused: [],
    advice: alike.slice(0, 1).map(({ other, signs }) => ({
      file,
      line,
      message: `${name} may be ${existingWords(other)}: ${signs.join(", ")}.`
    }))
  };
};

/** The package a file belongs to: the nearest with a manifest. */
const packageOf = (file: string, packages: readonly WorkspacePackage[]): WorkspacePackage | undefined =>
  packages
    .filter(({ dir }) => dir === "" || file.startsWith(`${dir}/`))
    .toSorted((first, second) => second.dir.length - first.dir.length)[0];

/** Whether a file could use a component of another: in one package, or one its package depends on. */
const canUse = (file: string, other: string, packages: readonly WorkspacePackage[]): boolean => {
  const [own, theirs] = [packageOf(file, packages), packageOf(other, packages)];
  return own === theirs || theirs === undefined || (own?.dependsOn.includes(theirs.name) ?? true);
};

/** A comment excusing a new component, when one stands within reach above it (anywhere in a single-file component). */
const excuseOf = (
  { name, file, line }: ScannedComponent,
  added: readonly AddedLine[]
): ExcusedValue | undefined => {
  for (const each of added) {
    const reason = each.file === file ? IGNORE_DUPLICATE.exec(each.text)?.[1] : undefined;
    const isNear = line === 1 || (each.line <= line && each.line >= line - IGNORE_REACH);
    if (reason !== undefined && isNear) {
      return { file, line: each.line, rule: "duplicate-component", reason: `${name}: ${reason.trim()}` };
    }
  }
  return undefined;
};

/** What the components were before the change: by file, and those of files it deleted, which may only have moved. */
const before = (
  previous: readonly ProjectFile[],
  changed: readonly ProjectFile[]
): {
  readonly names: ReadonlyMap<string, ReadonlySet<string>>;
  readonly imports: ReadonlyMap<string, ReadonlySet<string>>;
  readonly moved: {
    readonly names: ReadonlySet<string>;
    readonly codes: ReadonlySet<string>;
    readonly imports: ReadonlySet<string>;
  };
} => {
  const current = new Set(changed.map(({ file }) => file));
  const scanned = previous.map(({ file, text }) => ({
    file,
    components: scannedComponents(file, text),
    imported: importsOfFile(file, text).flatMap(({ names }) => names)
  }));
  const gone = scanned.filter(({ file }) => !current.has(file));
  return {
    names: new Map(
      scanned.map(({ file, components }) => [file, new Set(components.map(({ name }) => name))])
    ),
    imports: new Map(scanned.map(({ file, imported }) => [file, new Set(imported)])),
    moved: {
      names: new Set(gone.flatMap(({ components }) => components.map(({ name }) => name))),
      codes: new Set(gone.flatMap(({ components }) => components.flatMap(({ code }) => code ?? []))),
      imports: new Set(gone.flatMap(({ imported }) => imported))
    }
  };
};

/**
 * What a change adds against the components the project has. New means new against the commit it starts from: an edit of a
 * line that declares a component is no new component, nor is a file moved, nor a name a file already imported.
 *
 * @param input - the change and the project.
 */
export const reuseFindings = (input: ReuseInput): ReuseFindings => {
  const { added, changed, previous, components, packages } = input;
  const lines = new Map<string, Set<number>>();
  for (const { file, line } of added) lines.set(file, (lines.get(file) ?? new Set()).add(line));
  const isAdded = (file: string, from: number, to: number): boolean => {
    const own = lines.get(file);
    for (let at = from; own !== undefined && at <= to; at += 1) if (own.has(at)) return true;
    return false;
  };
  const was = before(previous, changed);
  const imports = changed.flatMap(({ file, text }) => {
    const isOld = (name: string): boolean =>
      was.imports.get(file)?.has(name) === true || was.moved.imports.has(name);
    return importsOfFile(file, text)
      .filter(({ lines: [from, to] }) => isAdded(file, from, to))
      .map((each) => importFindings(file, each, isOld, input));
  });
  const changedFiles = new Set(changed.map(({ file }) => file));
  const isNew = ({ file, name, code }: ScannedComponent): boolean =>
    changedFiles.has(file) &&
    was.names.get(file)?.has(name) !== true &&
    !was.moved.names.has(name) &&
    !(code !== undefined && was.moved.codes.has(code));
  const usable = components.filter((each) => each.isExported && isShareable(each));
  const fresh = usable.filter(isNew).map((each): ReuseFindings => {
    const excuse = excuseOf(each, added);
    if (excuse !== undefined) return { problems: [], advice: [], excused: [excuse] };
    const reachable = usable.filter((other) => !isNew(other) && canUse(each.file, other.file, packages));
    return newComponentFindings(each, reachable);
  });
  const all = [...imports, ...fresh];
  return {
    problems: all.flatMap((each) => each.problems),
    advice: [
      ...new Map(all.flatMap((each) => each.advice).map((each) => [JSON.stringify(each), each])).values()
    ].slice(0, MOST_ADVICE),
    excused: all.flatMap((each) => each.excused)
  };
};
