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
 * A hook's or a function's signature, read at the expression that names it: its type parameters, each parameter as
 * the source writes it (a destructured one by its pattern, a rest one marked) with its `@param` text, and the return
 * type with its `@returns` text. An overloaded function gives its first signature.
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
  // a hook typed through an alias (`const useX: UseX = …`) has its comment on its own declaration, not the alias's
  const ownTags = (symbol.declarations ?? []).flatMap((each) => [...ts.getJSDocTags(each)]);
  const ownParameterTag = (name: string): ts.JSDocParameterTag | undefined =>
    ownTags.filter(ts.isJSDocParameterTag).find((tag) => tag.name.getText() === name);
  const parameters = signature.parameters.map((parameter) => {
    const node = parameter.valueDeclaration;
    const written = node !== undefined && ts.isParameter(node) ? node : undefined;
    const tag =
      (written === undefined ? undefined : ts.getJSDocParameterTags(written)[0]) ??
      ownParameterTag(parameter.getName());
    return {
      // a destructured parameter has no name of its own: the checker calls it `__0`
      name:
        written === undefined || ts.isIdentifier(written.name)
          ? parameter.getName()
          : writtenText(written.name),
      type:
        written?.type === undefined
          ? checker.typeToString(checker.getTypeOfSymbolAtLocation(parameter, expression))
          : writtenText(written.type),
      description: tagText(tag?.comment),
      isOptional: written?.questionToken !== undefined || written?.initializer !== undefined,
      isRest: written?.dotDotDotToken !== undefined
    };
  });
  const returnType = declaration?.type;
  return {
    typeParameters: (declaration?.typeParameters ?? []).map(writtenText),
    parameters,
    returns:
      returnType === undefined ? checker.typeToString(signature.getReturnType()) : writtenText(returnType),
    returnsDescription: tagText(
      (
        (declaration === undefined ? undefined : ts.getJSDocReturnTag(declaration)) ??
        ownTags.find(ts.isJSDocReturnTag)
      )?.comment
    )
  };
};
