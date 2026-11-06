/**
 * A list or an object among a story's args as code, for the writers of a story's code in each framework: every framework
 * writes it as a JavaScript literal, and differs only in how a text is quoted and how a named value is written. Pure.
 *
 * @module
 */
import { type ArgValue, isArgList, isArgObject, isNamedArg, type NamedArg } from "./messages.ts";

/** How a framework writes the leaves of a literal. */
export type ExpressionWriter = {
  /** A text as an expression in this framework's markup. */
  readonly text: (text: string) => string;
  /** A named value as an expression, by its name. */
  readonly named: (named: NamedArg) => string;
};

/** A field's name in an object literal: bare when JavaScript allows it. */
const fieldName = (name: string, writer: ExpressionWriter): string =>
  /^[A-Za-z_$][\w$]*$/.test(name) ? name : writer.text(name);

/**
 * A value as a JavaScript expression.
 *
 * @param value - the value.
 * @param writer - how the framework writes its leaves.
 */
export const argExpression = (value: ArgValue, writer: ExpressionWriter): string => {
  if (typeof value === "string") return writer.text(value);
  if (isNamedArg(value)) return writer.named(value);
  if (isArgList(value)) return `[${value.map((item) => argExpression(item, writer)).join(", ")}]`;
  if (isArgObject(value)) {
    const fields = Object.entries(value).map(
      ([name, each]) => `${fieldName(name, writer)}: ${argExpression(each, writer)}`
    );
    return fields.length === 0 ? "{}" : `{ ${fields.join(", ")} }`;
  }
  return String(value);
};
