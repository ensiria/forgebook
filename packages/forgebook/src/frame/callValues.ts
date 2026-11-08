/**
 * A call's arguments as the Events tab shows them: each written short for the log, and an object's or a list's content to
 * open in it. Read in the frame, where the values are; only the text crosses. Pure.
 *
 * @module
 */

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * An event's argument written short for the call log.
 *
 * @param value - anything a callback received.
 */
export const previewValue = (value: unknown): string => {
  if (typeof value === "string") return JSON.stringify(value.length > 60 ? `${value.slice(0, 60)}…` : value);
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint")
    return String(value);
  if (value === null || value === undefined) return String(value);
  if (typeof value === "function") return "ƒ";
  if (typeof Event !== "undefined" && value instanceof Event) return value.constructor.name;
  if (isRecord(value) && "nativeEvent" in value) return "SyntheticEvent";
  return Array.isArray(value) ? `[…${value.length}]` : "{…}";
};

/** The most characters an argument's content keeps in the log. */
const DETAIL_LENGTH = 2000;

/**
 * An argument's content for the log, when it is an object or a list: JSON, two spaces deep, a function as `ƒ`, an
 * object met again as `[circular]`, cut past `DETAIL_LENGTH`; `null` for anything else (a text, a number, an event).
 *
 * @param value - anything a callback received.
 */
export const detailOf = (value: unknown): string | null => {
  if (typeof value !== "object" || value === null) return null;
  if (typeof Event !== "undefined" && value instanceof Event) return null;
  if ("nativeEvent" in value) return null;
  const seen = new WeakSet<object>();
  const text = JSON.stringify(
    value,
    (_key: string, inner: unknown): unknown => {
      if (typeof inner === "function") return "ƒ";
      if (typeof inner === "bigint") return `${inner}n`;
      if (typeof inner === "object" && inner !== null) {
        if (seen.has(inner)) return "[circular]";
        seen.add(inner);
      }
      return inner;
    },
    2
  );
  return text.length > DETAIL_LENGTH ? `${text.slice(0, DETAIL_LENGTH)}…` : text;
};
