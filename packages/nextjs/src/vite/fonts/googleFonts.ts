/**
 * Google fonts as `next/font/google` loads them: the style sheet's address for a call's options, checked as Next.js
 * checks them, and the font files downloaded beside the catalogue so the frames load them from it.
 *
 * @remarks
 * The families' weights, styles and variable axes come from Next.js's own list, which the project's `next` package
 * ships (`font-data.json`); without it a call cannot be checked, and is named in a warning. As Next.js does, the font
 * files are served by the catalogue, not by Google: the frames load nothing from Google, and a catalogue built once
 * keeps its fonts. A download that fails leaves Google's address in the style sheet, so the font still shows when the
 * page can reach Google.
 *
 * @module
 */

/** A family's data, as Next.js's list holds it. */
export type GoogleFontFamily = {
  /** Its weights (`"400"`), and `"variable"` for a variable font. */
  readonly weights: readonly string[];
  /** Its styles (`"normal"`, `"italic"`). */
  readonly styles: readonly string[];
  /** A variable font's axes, with their ranges. */
  readonly axes?: readonly { readonly tag: string; readonly min: number; readonly max: number }[];
};

/** Next.js's list of Google's families, by name. */
export type GoogleFontData = Readonly<Record<string, GoogleFontFamily>>;

/** What a call of a Google font asks for, checked. */
export type GoogleFontRequest = {
  /** The style sheet's address. */
  readonly url: string;
  /** The weights asked for: one weight gives the class a `font-weight`. */
  readonly weights: readonly string[];
  /** The styles asked for: one style gives the class a `font-style`. */
  readonly styles: readonly string[];
};

/** The `display` values Next.js accepts. */
const DISPLAYS = ["auto", "block", "swap", "fallback", "optional"];

/** The browser Google is asked as: one that takes WOFF2, as Next.js asks. */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36";

/** A font file's address in Google's style sheet. */
const FONT_URL = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A family's data read from Next.js's list, or none when the list does not have it as expected.
 *
 * @param data - the list, as its file parsed.
 * @param family - the family.
 */
export const googleFamily = (data: unknown, family: string): GoogleFontFamily | undefined => {
  const entry = isRecord(data) ? data[family] : undefined;
  if (!isRecord(entry)) return undefined;
  const { weights, styles, axes } = entry;
  if (!Array.isArray(weights) || !Array.isArray(styles)) return undefined;
  const texts = (values: readonly unknown[]): string[] => values.filter((value) => typeof value === "string");
  const readAxes = Array.isArray(axes)
    ? axes.flatMap((axis: unknown) =>
        isRecord(axis) &&
        typeof axis["tag"] === "string" &&
        typeof axis["min"] === "number" &&
        typeof axis["max"] === "number"
          ? [{ tag: axis["tag"], min: axis["min"], max: axis["max"] }]
          : []
      )
    : undefined;
  return {
    weights: texts(weights),
    styles: texts(styles),
    ...(readAxes === undefined ? {} : { axes: readAxes })
  };
};

/**
 * The texts an option gives: one text, or a list of them.
 *
 * @param value - the option.
 */
const textList = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
};

/**
 * Sorts the variants as Google requires: by style, then by weight.
 *
 * @param first - a variant's values (`0,400`).
 * @param second - another's.
 */
const byVariant = (first: string, second: string): number => {
  const [firstHead = "", firstTail = ""] = first.split(",", 2);
  const [secondHead = "", secondTail = ""] = second.split(",", 2);
  if (first.includes(",") && second.includes(",") && firstHead === secondHead)
    return Number.parseInt(firstTail, 10) - Number.parseInt(secondTail, 10);
  return Number.parseInt(firstHead, 10) - Number.parseInt(secondHead, 10);
};

/**
 * Sorts axes' tags as Google requires: lower-case ones first, each kind in alphabetical order.
 *
 * @param first - an axis tag.
 * @param second - another.
 */
const byAxisTag = (first: string, second: string): number => {
  const isFirstLower = first.charCodeAt(0) > 96;
  const isSecondLower = second.charCodeAt(0) > 96;
  if (isFirstLower !== isSecondLower) return isFirstLower ? -1 : 1;
  return first > second ? 1 : -1;
};

/** The weights, styles and display a call asks for, checked. */
type Selection = {
  /** The weights, or `["variable"]` for a variable font's whole range. */
  readonly weights: readonly string[];
  /** The styles. */
  readonly styles: readonly string[];
  /** The `font-display`. */
  readonly display: string;
};

/**
 * The weights, styles and display a call asks for, checked against the family as Next.js checks them.
 *
 * @param family - the family.
 * @param options - the call's options.
 * @param data - the family's data.
 * @returns the selection, or why the call is wrong.
 */
const selectionOf = (
  family: string,
  options: Readonly<Record<string, unknown>>,
  data: GoogleFontFamily
): Selection | string => {
  const asked = [...new Set(textList(options["weight"]))];
  const weights = asked.length === 0 && data.weights.includes("variable") ? ["variable"] : asked;
  if (weights.length === 0)
    return `${family}: give a weight (${data.weights.join(", ")}), since it is not a variable font`;
  const unknownWeight = weights.find((weight) => !data.weights.includes(weight));
  if (unknownWeight !== undefined)
    return `${family}: no weight ${unknownWeight} (${data.weights.join(", ")})`;
  const askedStyles = [...new Set(textList(options["style"]))];
  const defaultStyle = data.styles.includes("normal") ? "normal" : (data.styles[0] ?? "normal");
  const styles = askedStyles.length === 0 ? [defaultStyle] : askedStyles;
  const unknownStyle = styles.find((style) => !data.styles.includes(style));
  if (unknownStyle !== undefined) return `${family}: no style ${unknownStyle} (${data.styles.join(", ")})`;
  const display = typeof options["display"] === "string" ? options["display"] : "swap";
  if (!DISPLAYS.includes(display)) return `${family}: no display ${display} (${DISPLAYS.join(", ")})`;
  return { weights, styles, display };
};

/**
 * The weight values and the extra variable axes of a selection: a variable font's ranges, or the weights given.
 *
 * @param family - the family.
 * @param selection - the weights asked for.
 * @param extraAxes - the variable axes asked for besides the weight (`["opsz"]`).
 * @param data - the family's data.
 * @returns the axes, or why the call is wrong.
 */
const axesOf = (
  family: string,
  selection: Selection,
  extraAxes: readonly string[],
  data: GoogleFontFamily
): { readonly wght: readonly string[]; readonly variableAxes: readonly [string, string][] } | string => {
  if (selection.weights[0] !== "variable")
    return extraAxes.length > 0
      ? `${family}: axes are only for a variable font, without a weight`
      : { wght: selection.weights, variableAxes: [] };
  const axes = data.axes ?? [];
  const weightAxis = axes.find((axis) => axis.tag === "wght");
  return {
    wght: weightAxis === undefined ? [] : [`${weightAxis.min}..${weightAxis.max}`],
    variableAxes: axes
      .filter((axis) => axis.tag !== "wght" && extraAxes.includes(axis.tag))
      .map((axis): [string, string] => [axis.tag, `${axis.min}..${axis.max}`])
  };
};

/**
 * The address's axes part (`:ital,wght@0,400;1,400`), each variant a combination of a style and a weight.
 *
 * @param styles - the styles asked for.
 * @param wght - the weight values.
 * @param variableAxes - the extra variable axes.
 */
const axesPart = (
  styles: readonly string[],
  wght: readonly string[],
  variableAxes: readonly [string, string][]
): string => {
  const ital = styles.includes("italic") ? [...(styles.includes("normal") ? ["0"] : []), "1"] : undefined;
  const variants: [string, string][][] = wght.flatMap((weight) =>
    ital === undefined
      ? [[["wght", weight], ...variableAxes]]
      : ital.map((style): [string, string][] => [["ital", style], ["wght", weight], ...variableAxes])
  );
  if (wght.length === 0 && variableAxes.length > 0) variants.push([...variableAxes]);
  for (const variant of variants) variant.sort(([first], [second]) => byAxisTag(first, second));
  const [first] = variants;
  if (first === undefined) return "";
  const values = variants.map((variant) => variant.map(([, value]) => value).join(",")).sort(byVariant);
  return `:${first.map(([tag]) => tag).join(",")}@${values.join(";")}`;
};

/**
 * What a call of a Google font asks for, checked as Next.js checks it.
 *
 * @param family - the family (`Roboto Mono`).
 * @param options - the call's options.
 * @param data - the family's data from Next.js's list.
 * @returns the request, or why the call is wrong.
 */
export const googleFontRequest = (
  family: string,
  options: Readonly<Record<string, unknown>>,
  data: GoogleFontFamily
): GoogleFontRequest | string => {
  const selection = selectionOf(family, options, data);
  if (typeof selection === "string") return selection;
  const axes = axesOf(family, selection, textList(options["axes"]), data);
  if (typeof axes === "string") return axes;
  const name = family.replaceAll(" ", "+");
  return {
    url: `https://fonts.googleapis.com/css2?family=${name}${axesPart(selection.styles, axes.wght, axes.variableAxes)}&display=${selection.display}`,
    weights: selection.weights,
    styles: selection.styles
  };
};

/** Fetches an address: `fetch`, or a stand-in in the tests. */
export type Fetcher = (
  url: string,
  init: { readonly headers: Readonly<Record<string, string>> }
) => Promise<Response>;

/**
 * Google's style sheet for a request.
 *
 * @param url - the style sheet's address.
 * @param fetcher - how to fetch it.
 * @returns its text, or why it could not be had.
 */
export const fetchGoogleCss = async (url: string, fetcher: Fetcher): Promise<string | Error> => {
  try {
    const response = await fetcher(url, { headers: { "user-agent": USER_AGENT } });
    if (!response.ok) return new Error(`Google Fonts answered ${response.status} for ${url}`);
    return await response.text();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
};

/**
 * The font files a Google style sheet names.
 *
 * @param css - the style sheet.
 */
export const googleFontFiles = (css: string): string[] => [
  ...new Set([...css.matchAll(FONT_URL)].flatMap((match) => (match[1] === undefined ? [] : [match[1]])))
];

/**
 * A Google style sheet with each font file's address replaced by the file downloaded, where the download worked.
 *
 * @param css - the style sheet.
 * @param saved - each font file's address on Google, and the file's address beside the style sheet.
 */
export const selfHostedCss = (css: string, saved: ReadonlyMap<string, string>): string =>
  css.replace(FONT_URL, (whole: string, url: string) => {
    const local = saved.get(url);
    return local === undefined ? whole : `url(${JSON.stringify(local)})`;
  });
