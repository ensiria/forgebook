/**
 * A custom control that gives the panel what its own schema refuses, and what is no JSON.
 *
 * @module
 */
import type { ArgControlProps } from "forgebook/arg-control";

/** A text. */
export const schema = { type: "string" };

/**
 * Draws a button that gives a number.
 *
 * @param element - where it draws.
 * @param props - how to change the value.
 * @returns what takes it away.
 */
export const mount = (element: HTMLElement, { onChange }: ArgControlProps): (() => void) => {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Give a number";
  button.addEventListener("click", () => onChange(3));
  element.append(button);
  return () => button.remove();
};
