/**
 * The check a frame makes of what arrives from the shell: a page may receive messages from anything it embeds or is
 * embedded in. Kept with the frame, so that the shell's page does not load what only the frame reads.
 *
 * @module
 */
import { isMatrix } from "../matrix.ts";
import { isPanelArgs, type ShellMessage } from "../messages.ts";
import { type ClockState, isClockRate } from "../storyClock.ts";
import { type LiveView, MEASURE_TOOLS } from "../viewState.ts";

/** Whether a value is a plain object. */
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Whether a value is a list of strings. */
const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** Whether a value is the view's live part. */
const isLiveView = (value: unknown): value is LiveView =>
  isRecord(value) &&
  isRecord(value["switches"]) &&
  Object.values(value["switches"]).every((switchValue) => typeof switchValue === "string") &&
  typeof value["backdrop"] === "string" &&
  typeof value["text"] === "number";

/** Whether a value is a story clock's state. */
const isClockState = (value: unknown): value is ClockState =>
  isRecord(value) && typeof value["isRunning"] === "boolean" && isClockRate(value["rate"]);

/**
 * Whether a received message is one the shell sends.
 *
 * @param value - the message's data.
 */
export const isShellMessage = (value: unknown): value is ShellMessage => {
  if (!isRecord(value)) return false;
  if (
    value["type"] === "forgebook:replay" ||
    value["type"] === "forgebook:check" ||
    value["type"] === "forgebook:play-again" ||
    value["type"] === "forgebook:clock-restart"
  ) {
    return true;
  }
  if (value["type"] === "forgebook:args") return isPanelArgs(value["args"]);
  if (value["type"] === "forgebook:view") return isLiveView(value["view"]);
  if (value["type"] === "forgebook:clock") return isClockState(value["state"]);
  if (value["type"] === "forgebook:spills") return typeof value["isOn"] === "boolean";
  if (value["type"] === "forgebook:tools") {
    const tools = value["tools"];
    return Array.isArray(tools) && tools.every((tool) => MEASURE_TOOLS.some((known) => known === tool));
  }
  if (value["type"] === "forgebook:matrix") return value["matrix"] === null || isMatrix(value["matrix"]);
  return value["type"] === "forgebook:events" && isStringList(value["names"]);
};
