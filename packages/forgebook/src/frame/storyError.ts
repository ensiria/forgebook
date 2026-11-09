/**
 * The error a frame shows in place of a story that threw: its message and its stack, in the classes the frame's status
 * and the catalogue's tests read.
 *
 * @module
 */
import { ERROR_MESSAGE_CLASS, ERROR_STACK_CLASS } from "./frameStatus.ts";

/**
 * The error shown in place of a story that threw: its message and its stack.
 *
 * @param document - the frame's document.
 * @param error - the error.
 */
export const errorElement = (document: Document, error: Error): HTMLElement => {
  const box = document.createElement("div");
  box.className = "forgebook-frame-error";
  box.setAttribute("role", "alert");
  const message = document.createElement("p");
  message.className = ERROR_MESSAGE_CLASS;
  message.textContent = error.message;
  box.append(message);
  if (error.stack !== undefined) {
    const stack = document.createElement("pre");
    stack.className = ERROR_STACK_CLASS;
    stack.textContent = error.stack;
    box.append(stack);
  }
  return box;
};
