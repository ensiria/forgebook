/**
 * Nuxt's error, as `createError` makes it and `useError` returns it: an `Error` with an HTTP status and data.
 *
 * @module
 */

/** What `createError` takes besides a message: Nuxt's fields, each optional. */
export type NuxtErrorInput = {
  /** The message. */
  readonly message?: string;
  /** The HTTP status; 500 by default. */
  readonly statusCode?: number;
  /** The HTTP status's text. */
  readonly statusMessage?: string;
  /** Whether the error replaces the page with Nuxt's error page; `false` by default. */
  readonly fatal?: boolean;
  /** What the error carries for the page that shows it. */
  readonly data?: unknown;
  /** What caused it. */
  readonly cause?: unknown;
};

/** An error as Nuxt makes it. */
export class NuxtError extends Error {
  /** The HTTP status. */
  readonly statusCode: number;
  /** The HTTP status's text. */
  readonly statusMessage: string | undefined;
  /** Whether it replaces the page. */
  readonly fatal: boolean;
  /** What it carries. */
  readonly data: unknown;
  /**
   * An error from Nuxt's fields.
   *
   * @param input - the message and the fields.
   */
  constructor(input: NuxtErrorInput) {
    super(input.message ?? input.statusMessage ?? "", { cause: input.cause });
    this.name = "NuxtError";
    this.statusCode = input.statusCode ?? 500;
    this.statusMessage = input.statusMessage;
    this.fatal = input.fatal ?? false;
    this.data = input.data;
  }
}

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Nuxt's fields read from an error another library threw (a fetch's `FetchError` has `statusCode` and `data`).
 *
 * @param value - the error.
 */
const fieldsOf = (value: Readonly<Record<string, unknown>>): NuxtErrorInput => ({
  ...(typeof value["message"] === "string" ? { message: value["message"] } : {}),
  ...(typeof value["statusCode"] === "number" ? { statusCode: value["statusCode"] } : {}),
  ...(typeof value["statusMessage"] === "string" ? { statusMessage: value["statusMessage"] } : {}),
  ...(typeof value["fatal"] === "boolean" ? { fatal: value["fatal"] } : {}),
  ...("data" in value ? { data: value["data"] } : {})
});

/**
 * An error as Nuxt makes it: from a message, Nuxt's fields, or another error (kept as its cause).
 *
 * @param input - the message, the fields or the error.
 * @returns the error; a `NuxtError` given is returned as it is.
 */
export const createError = (input: string | NuxtErrorInput | Error | unknown): NuxtError => {
  if (input instanceof NuxtError) return input;
  if (typeof input === "string") return new NuxtError({ message: input });
  // read field by field: a fetch error's status is a getter, which a spread would not copy
  if (input instanceof Error && isRecord(input)) return new NuxtError({ ...fieldsOf(input), cause: input });
  return new NuxtError(isRecord(input) ? fieldsOf(input) : { message: String(input) });
};

/**
 * Whether a value is an error Nuxt made.
 *
 * @param value - the value.
 */
export const isNuxtError = (value: unknown): value is NuxtError => value instanceof NuxtError;
