/**
 * A hook's or a function's signature, read from its types and TSDoc: what a story about logic documents first. Part of
 * the docs module of `@forgebook/react` (`extractDocs.ts`).
 *
 * @module
 */
import type { FunctionSignatureDocs } from "forgebook/component-docs";
import ts from "typescript-6";

/**
 * A type as the source writes it, on one line.
 *
 * @param node - the type's node.
 */
const writtenText = (node: ts.Node): string => node.getText().replace(/\s+/g, " ").trim();

/**
 * A JSDoc tag's text on one line.
 *
 * @param comment - the tag's comment.
 */
const tagText = (comment: string | ts.NodeArray<ts.JSDocComment> | undefined): string =>
  (ts.getTextOfJSDocComment(comment) ?? "").replace(/^-\s*/, "").replace(/\s+/g, " ").trim();

/**
 * A hook's or a function's signature, read at the expression that names it: each parameter as the source writes its
 * type, with its `@param` text, and the return type with its `@returns` text.
 *
 * @param symbol - the function's declared symbol.
 * @param expression - where the code names it.
 * @param checker - the program's checker.
 */
export const signatureDocs = (
  symbol: ts.Symbol,
  expression: ts.Expression,
  checker: ts.TypeChecker
): FunctionSignatureDocs | undefined => {
  const [signature] = checker.getTypeOfSymbolAtLocation(symbol, expression).getCallSignatures();
  if (signature === undefined) return undefined;
  // a signature the checker made (a mapped or an intersected type) has no declaration
  const declaration: ts.SignatureDeclaration | undefined = signature.getDeclaration();
  const parameters = signature.parameters.map((parameter) => {
    const node = parameter.valueDeclaration;
    const written = node !== undefined && ts.isParameter(node) ? node : undefined;
    const tag = written === undefined ? undefined : ts.getJSDocParameterTags(written)[0];
    return {
      name: parameter.getName(),
      type:
        written?.type === undefined
          ? checker.typeToString(checker.getTypeOfSymbolAtLocation(parameter, expression))
          : writtenText(written.type),
      description: tagText(tag?.comment),
      isOptional: written?.questionToken !== undefined || written?.initializer !== undefined
    };
  });
  const returnType = declaration?.type;
  return {
    parameters,
    returns:
      returnType === undefined ? checker.typeToString(signature.getReturnType()) : writtenText(returnType),
    returnsDescription: declaration === undefined ? "" : tagText(ts.getJSDocReturnTag(declaration)?.comment)
  };
};
