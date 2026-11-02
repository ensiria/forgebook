/**
 * What an Angular component or directive takes, read from its class and its decorator without running them: its inputs
 * (decorated `@Input()`, signal `input()` and `model()`, and those its decorator's `inputs` lists), its outputs
 * (`@Output()`, `output()`, `outputFromObservable()`, a model's `<name>Change`) and the content its template projects
 * (`<ng-content select>`), each as the panel lists it.
 *
 * @remarks
 * An input or an output is named as a template binds it, by its alias when it has one, which is also the arg a story
 * sets. A signal input's type is the value its signal holds (`input<"md" | "sm">()` is a choice), a decorated input's
 * its field's; a signal input says itself whether it is required (`input.required()`), a decorated one through
 * `{ required: true }`. A projected content is the arg that fills it (`#default`, `#[icon]`), any text. The inherited
 * members count, as Angular inherits them.
 *
 * @module
 */
import { dirname } from "node:path";

import type { PropDocs } from "forgebook/component-docs";
import { summaryOf } from "forgebook/vite/docs-program";
import { declarationOrder, declaredSymbol, propDocs } from "forgebook/vite/prop-docs";
import ts from "typescript-6";

import { classMetadata, decoratorsOf, propertyOf, textOf } from "./classDecorators.ts";
import { contentDocs, contentSelectors, templateOf } from "./templateContent.ts";

/** Whether an expression writes `true`. */
const isTrue = (expression: ts.Expression | undefined): boolean =>
  expression?.kind === ts.SyntaxKind.TrueKeyword;

/** A signal function's call: `input()`, `input.required()`, `model()`, `output()`, `outputFromObservable()`. */
type SignalCall = {
  /** The function (`input`, `model`, `output`, `outputFromObservable`). */
  readonly kind: string;
  /** Whether it is `.required`. */
  readonly isRequired: boolean;
  /** The call. */
  readonly call: ts.CallExpression;
};

/** The signal functions that declare an input, a model or an output. */
const SIGNAL_FUNCTIONS = ["input", "model", "output", "outputFromObservable"];

/**
 * The signal function a field's initialiser calls.
 *
 * @param member - the class's member.
 */
const signalCallOf = (member: ts.Node): SignalCall | undefined => {
  if (!ts.isPropertyDeclaration(member) || member.initializer === undefined) return undefined;
  const call = member.initializer;
  if (!ts.isCallExpression(call)) return undefined;
  const callee = call.expression;
  if (ts.isIdentifier(callee) && SIGNAL_FUNCTIONS.includes(callee.text))
    return { kind: callee.text, isRequired: false, call };
  if (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    SIGNAL_FUNCTIONS.includes(callee.expression.text) &&
    callee.name.text === "required"
  )
    return { kind: callee.expression.text, isRequired: true, call };
  return undefined;
};

/** The options object a signal function is called with: its last argument, or its only one for `.required`. */
const signalOptions = (signal: SignalCall): ts.ObjectLiteralExpression | undefined => {
  const options = signal.call.arguments[signal.isRequired || signal.kind === "output" ? 0 : 1];
  return options !== undefined && ts.isObjectLiteralExpression(options) ? options : undefined;
};

/** One input, before its docs. */
type InputMember = {
  /** The member. */
  readonly symbol: ts.Symbol;
  /** The name a template binds. */
  readonly name: string;
  /** Whether it must be bound. */
  readonly isRequired: boolean;
  /** For an input set through a setter, the type its parameter takes, which a binding sets. */
  readonly setter?: { readonly type: ts.Type; readonly typeNode: ts.TypeNode | undefined };
  /** For a signal input, the value it holds and the type node writing it. */
  readonly signal?: {
    readonly type: ts.Type;
    readonly typeNode: ts.TypeNode | undefined;
    readonly initial?: string;
  };
};

/** One output, before its docs. */
type OutputMember = {
  /** The member. */
  readonly symbol: ts.Symbol;
  /** The name a template listens to. */
  readonly name: string;
};

/** What a decorator's `inputs` or `outputs` lists: `"name"`, `"name: alias"`, `{ name, alias, required }`. */
type ListedMember = { readonly property: string; readonly name: string; readonly isRequired: boolean };

/**
 * The members a class decorator's `inputs` or `outputs` lists.
 *
 * @param metadata - the decorator's object.
 * @param field - `inputs` or `outputs`.
 */
const listedMembers = (metadata: ts.ObjectLiteralExpression | undefined, field: string): ListedMember[] => {
  const list = propertyOf(metadata, field);
  if (list === undefined || !ts.isArrayLiteralExpression(list)) return [];
  return list.elements.flatMap((element): ListedMember[] => {
    const text = textOf(element);
    if (text !== undefined) {
      const [property = "", alias] = text.split(":").map((part) => part.trim());
      return [{ property, name: alias ?? property, isRequired: false }];
    }
    if (!ts.isObjectLiteralExpression(element)) return [];
    const property = textOf(propertyOf(element, "name"));
    if (property === undefined) return [];
    return [
      {
        property,
        name: textOf(propertyOf(element, "alias")) ?? property,
        isRequired: isTrue(propertyOf(element, "required"))
      }
    ];
  });
};

/** The value a signal holds: what its type returns when called (`InputSignal<string>` is called for a `string`). */
const heldType = (type: ts.Type): ts.Type | undefined => type.getCallSignatures()[0]?.getReturnType();

/** A short initial value as written, for a default: a literal or a name, not a computation, nor `undefined`. */
const initialText = (expression: ts.Expression | undefined): string | undefined => {
  if (expression === undefined) return undefined;
  const text = expression.getText();
  if (text === "undefined") return undefined;
  return text.length <= 40 && !text.includes("\n") ? text : undefined;
};

/** The members of a class, Angular's and inherited ones, each once. */
type ClassMembers = {
  /** The inputs, in declaration order. */
  readonly inputs: readonly InputMember[];
  /** The outputs, in declaration order. */
  readonly outputs: readonly OutputMember[];
};

/** What a class's decorator lists of its members, and where the class is read. */
type MemberContext = {
  /** The class. */
  readonly node: ts.ClassDeclaration;
  /** The program's checker. */
  readonly checker: ts.TypeChecker;
  /** The inputs its decorator's `inputs` lists. */
  readonly listedInputs: readonly ListedMember[];
  /** The outputs its decorator's `outputs` lists. */
  readonly listedOutputs: readonly ListedMember[];
};

/**
 * A signal input or model: an input, and a model's change as an output.
 *
 * @param symbol - the member.
 * @param signal - its initialiser's call.
 * @param context - the class.
 */
const signalInput = (symbol: ts.Symbol, signal: SignalCall, context: MemberContext): ClassMembers => {
  const name = textOf(propertyOf(signalOptions(signal), "alias")) ?? symbol.getName();
  const type = heldType(context.checker.getTypeOfSymbolAtLocation(symbol, context.node));
  if (type === undefined) return { inputs: [], outputs: [] };
  const initial = signal.isRequired ? undefined : initialText(signal.call.arguments[0]);
  const typeNode = signal.call.typeArguments?.[0];
  const input: InputMember = {
    symbol,
    name,
    isRequired: signal.isRequired,
    signal: { type, typeNode, ...(initial === undefined ? {} : { initial }) }
  };
  return { inputs: [input], outputs: signal.kind === "model" ? [{ symbol, name: `${name}Change` }] : [] };
};

/**
 * A decorated member, or one the class's decorator lists: an input, an output, or neither.
 *
 * @param symbol - the member.
 * @param declaration - its declaration.
 * @param context - the class.
 */
const decoratedMember = (symbol: ts.Symbol, context: MemberContext): ClassMembers => {
  const property = symbol.getName();
  // a getter and its setter are two declarations, and either may carry the decorator
  const decorators = (symbol.declarations ?? []).flatMap(decoratorsOf);
  const decoratedInput = decorators.find((each) => each.name === "Input");
  const listedInput = context.listedInputs.find((each) => each.property === property);
  if (decoratedInput !== undefined || listedInput !== undefined) {
    const [argument] = decoratedInput?.arguments ?? [];
    const options = argument !== undefined && ts.isObjectLiteralExpression(argument) ? argument : undefined;
    const name = textOf(argument) ?? textOf(propertyOf(options, "alias")) ?? listedInput?.name ?? property;
    const isRequired = isTrue(propertyOf(options, "required")) || listedInput?.isRequired === true;
    const setter = setterTypeOf(symbol, context.checker);
    return {
      inputs: [{ symbol, name, isRequired, ...(setter === undefined ? {} : { setter }) }],
      outputs: []
    };
  }
  const decoratedOutput = decorators.find((each) => each.name === "Output");
  const listedOutput = context.listedOutputs.find((each) => each.property === property);
  if (decoratedOutput === undefined && listedOutput === undefined) return { inputs: [], outputs: [] };
  const name = textOf(decoratedOutput?.arguments[0]) ?? listedOutput?.name ?? property;
  return { inputs: [], outputs: [{ symbol, name }] };
};

/**
 * What one member of a class is to a template.
 *
 * @param symbol - the member.
 * @param context - the class.
 */
const memberOf = (symbol: ts.Symbol, context: MemberContext): ClassMembers => {
  const field = symbol.declarations?.find(ts.isPropertyDeclaration);
  const signal = field === undefined ? undefined : signalCallOf(field);
  if (signal === undefined) return decoratedMember(symbol, context);
  if (signal.kind === "input" || signal.kind === "model") return signalInput(symbol, signal, context);
  const name = textOf(propertyOf(signalOptions(signal), "alias")) ?? symbol.getName();
  return { inputs: [], outputs: [{ symbol, name }] };
};

/**
 * A class and the classes it extends, nearest first.
 *
 * @param node - the class.
 * @param checker - the program's checker.
 */
const classChain = (node: ts.ClassDeclaration, checker: ts.TypeChecker): ts.ClassDeclaration[] => {
  const chain: ts.ClassDeclaration[] = [];
  let current: ts.ClassDeclaration | undefined = node;
  while (current !== undefined && !chain.includes(current)) {
    chain.push(current);
    const base: ts.Expression | undefined = current.heritageClauses?.find(
      (clause) => clause.token === ts.SyntaxKind.ExtendsKeyword
    )?.types[0]?.expression;
    const symbol: ts.Symbol | undefined =
      base === undefined ? undefined : declaredSymbol(checker.getSymbolAtLocation(base), checker);
    current = symbol?.declarations?.find(ts.isClassDeclaration);
  }
  return chain;
};

/**
 * The type a setter input's parameter takes: Angular sets what the setter takes, whatever its getter returns.
 *
 * @param symbol - the input.
 * @param checker - the program's checker.
 */
const setterTypeOf = (symbol: ts.Symbol, checker: ts.TypeChecker): InputMember["setter"] => {
  const [parameter] = symbol.declarations?.find(ts.isSetAccessorDeclaration)?.parameters ?? [];
  if (parameter === undefined) return undefined;
  return { type: checker.getTypeAtLocation(parameter), typeNode: parameter.type };
};

/**
 * The inputs and outputs of a class, its own and inherited, in declaration order.
 *
 * @param node - the class.
 * @param checker - the program's checker.
 */
const classMembers = (node: ts.ClassDeclaration, checker: ts.TypeChecker): ClassMembers => {
  // the `inputs` and `outputs` a base class's decorator lists are inherited too
  const chain = classChain(node, checker);
  const listed = (field: string): ListedMember[] =>
    chain.flatMap((each) => listedMembers(classMetadata(each), field));
  const context: MemberContext = {
    node,
    checker,
    listedInputs: listed("inputs"),
    listedOutputs: listed("outputs")
  };
  const symbols = declarationOrder(
    checker.getTypeAtLocation(node).getProperties(),
    dirname(node.getSourceFile().fileName)
  );
  const members = symbols.map((symbol) => memberOf(symbol, context));
  return {
    inputs: members.flatMap((member) => member.inputs),
    outputs: members.flatMap((member) => member.outputs)
  };
};

/**
 * What an output passes: the parameter of its `emit`, or of what `subscribe` calls (`outputFromObservable`).
 *
 * @param type - the output's type (`OutputEmitterRef<string>`, `EventEmitter<string>`).
 * @param checker - the program's checker.
 * @param node - where the class is.
 */
const emittedType = (type: ts.Type, checker: ts.TypeChecker, node: ts.Node): ts.Type | undefined => {
  const emit = type.getProperty("emit");
  if (emit !== undefined) {
    const [parameter] =
      checker.getTypeOfSymbolAtLocation(emit, node).getCallSignatures()[0]?.parameters ?? [];
    if (parameter !== undefined)
      return checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(parameter, node));
  }
  const subscribe = type.getProperty("subscribe");
  const [callback] =
    subscribe === undefined
      ? []
      : (checker.getTypeOfSymbolAtLocation(subscribe, node).getCallSignatures()[0]?.parameters ?? []);
  const [value] =
    callback === undefined
      ? []
      : (checker.getTypeOfSymbolAtLocation(callback, node).getCallSignatures()[0]?.parameters ?? []);
  return value === undefined ? undefined : checker.getTypeOfSymbolAtLocation(value, node);
};

/**
 * One input's docs.
 *
 * @param input - the input.
 * @param checker - the program's checker.
 * @param node - where the class is.
 */
const inputDocs = (input: InputMember, checker: ts.TypeChecker, node: ts.Node): PropDocs => {
  const docs = propDocs(input.symbol, checker, node, input.signal ?? input.setter);
  const field = input.symbol.declarations?.find(ts.isPropertyDeclaration);
  const initial = input.signal === undefined ? initialText(field?.initializer) : input.signal.initial;
  // a `@defaultValue` the TSDoc writes says more than the code's initial value
  const defaultValue = docs.defaultValue ?? initial;
  return {
    ...docs,
    name: input.name,
    isRequired: input.isRequired,
    ...(defaultValue === undefined ? {} : { defaultValue })
  };
};

/**
 * One output's docs, as the handler a story sets.
 *
 * @param output - the output.
 * @param checker - the program's checker.
 * @param node - where the class is.
 */
const outputDocs = (output: OutputMember, checker: ts.TypeChecker, node: ts.Node): PropDocs => {
  const type = checker.getTypeOfSymbolAtLocation(output.symbol, node);
  // a model's change passes the value the model holds (a model is a signal; an output is not)
  const passed = heldType(type) ?? emittedType(type, checker, node);
  const passedText = passed === undefined ? "unknown" : checker.typeToString(passed);
  const isVoid = passed !== undefined && (passed.flags & ts.TypeFlags.Void) !== 0;
  const parameters = isVoid ? [] : [{ name: "value", type: passedText }];
  return {
    name: output.name,
    kind: "event",
    type: `(${parameters.map((each) => `${each.name}: ${each.type}`).join(", ")}) => void`,
    description: summaryOf(output.symbol, checker),
    isRequired: false,
    signature: { parameters, returns: "void" }
  };
};

/** What a class takes, with the files it was read from. */
export type ClassProps = {
  /** Its inputs, then its projected content, then its outputs. */
  readonly props: readonly PropDocs[];
  /** The files they come from: the class's, its template's, its inherited members'. */
  readonly sources: readonly string[];
};

/**
 * What a component or a directive takes.
 *
 * @param node - the class.
 * @param checker - the program's checker.
 */
export const classProps = (node: ts.ClassDeclaration, checker: ts.TypeChecker): ClassProps => {
  const { inputs, outputs } = classMembers(node, checker);
  const template = templateOf(node);
  const contents = template === undefined ? [] : contentSelectors(template.text);
  const memberFiles = [...inputs, ...outputs].flatMap((member) =>
    (member.symbol.declarations ?? []).map((declaration) => declaration.getSourceFile().fileName)
  );
  return {
    props: [
      ...inputs.map((input) => inputDocs(input, checker, node)),
      ...contents.map(contentDocs),
      ...outputs.map((output) => outputDocs(output, checker, node))
    ],
    sources: [
      ...new Set([
        node.getSourceFile().fileName,
        ...(template?.file === undefined ? [] : [template.file]),
        ...memberFiles
      ])
    ]
  };
};
