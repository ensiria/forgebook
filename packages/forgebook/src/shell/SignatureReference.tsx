/**
 * A hook's or a function's signature, as a story about logic documents it: the call on one line, a table of its
 * parameters (name, type, what it is), then what it returns. On the component page in place of the props table, and
 * in the story's panel as its first tab.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { FunctionSignatureDocs } from "../componentDocs.ts";
import { Code } from "./Code.tsx";
import { CodeText } from "./CodeText.tsx";
import { STRINGS } from "./strings.ts";

/**
 * The type parameters as the call writes them: `<TValue>`, or nothing.
 *
 * @param typeParameters - the type parameters.
 */
const typeParametersText = (typeParameters: readonly string[]): string =>
  typeParameters.length === 0 ? "" : `<${typeParameters.join(", ")}>`;

/**
 * The call as one line of TypeScript: `useUndo<TValue>(initial: TValue, limit?: number): UndoState<TValue>`.
 *
 * @param name - the function's name.
 * @param signature - its signature.
 */
export const callText = (name: string, signature: FunctionSignatureDocs): string =>
  `${name}${typeParametersText(signature.typeParameters)}(${signature.parameters
    .map(
      (parameter) =>
        `${parameter.isRest ? "..." : ""}${parameter.name}${parameter.isOptional ? "?" : ""}: ${parameter.type}`
    )
    .join(", ")}): ${signature.returns}`;

/**
 * The signature's reference.
 *
 * @param props - the function's name and signature.
 */
export const SignatureReference = ({
  name,
  signature
}: {
  readonly name: string;
  readonly signature: FunctionSignatureDocs;
}): ReactNode => (
  <div className="forgebook-signature">
    <pre className="forgebook-signature__call">
      <Code
        text={callText(name, signature)}
        names={signature.parameters.map((parameter) => parameter.name)}
      />
    </pre>
    {signature.parameters.length === 0 ? (
      <p className="forgebook-tab-note">{STRINGS.signatureNone}</p>
    ) : (
      <div className="forgebook-api">
        <table className="forgebook-api__table">
          <thead>
            <tr>
              <th scope="col">{STRINGS.signatureParameter}</th>
              <th scope="col">{STRINGS.apiType}</th>
              <th scope="col">{STRINGS.apiWhat}</th>
            </tr>
          </thead>
          <tbody>
            {signature.parameters.map((parameter) => (
              <tr key={parameter.name} data-prop={parameter.name}>
                <th scope="row">
                  <code className="forgebook-api__name">
                    {parameter.isRest ? "..." : ""}
                    {parameter.name}
                  </code>
                  {/* a rest parameter may always be left out */}
                  {parameter.isOptional || parameter.isRest ? null : (
                    <span className="forgebook-prop__required" title={STRINGS.required}>
                      *
                    </span>
                  )}
                </th>
                <td className="forgebook-api__type">
                  <Code text={parameter.type} names={[]} />
                </td>
                <td>
                  <CodeText text={parameter.description} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    <h3 className="forgebook-signature__returns">{STRINGS.signatureReturns}</h3>
    <p>
      <code className="forgebook-inline-code">{signature.returns}</code>
      {signature.returnsDescription === "" ? null : (
        <>
          {" "}
          <CodeText text={signature.returnsDescription} />
        </>
      )}
    </p>
  </div>
);
