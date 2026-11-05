/**
 * What a simulated finger's tap does to an editable field: it focuses the field and puts the caret under the finger, the
 * reactions a dispatched event never gets from the browser. Used by the touch layer (`touchLayer.ts`), which loads
 * only when the Touch switch is on.
 *
 * @remarks
 * `caretPositionFromPoint` answers the character's place for an input or a textarea (the field itself as its node, in
 * Chromium, Firefox and WebKit) and for a contenteditable (a text node). `caretRangeFromPoint`, for a browser without it,
 * answers only for a contenteditable: for the other two it names an unrelated place, so they go to their end there.
 *
 * @module
 */
import type { Point } from "./touchGesture.ts";

/** A field with a value and the caret in it. */
type TextControl = HTMLInputElement | HTMLTextAreaElement;

/** A place for the caret. */
type CaretSpot = {
  /** The node holding it. */
  readonly node: Node;
  /** How far into the node, in UTF-16 code units. */
  readonly offset: number;
};

/** The input types with a caret: the others (a checkbox, a range, a date…) keep the browser's own reaction. */
const CARET_INPUT_TYPES: ReadonlySet<string> = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
  "number"
]);

/** What is interactive by itself inside a label: a tap on it does not activate the label. */
const LABEL_INTERACTIVE = "a[href], button, input, select, textarea, summary, [tabindex]";

/**
 * Whether a field is an input or a textarea.
 *
 * @param field - the field.
 */
const isTextControl = (field: HTMLElement): field is TextControl =>
  field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement;

/**
 * The editable field a node is in, the one a finger on it would focus: an input with a caret or a textarea, not
 * disabled (a read-only one still takes the caret, as under a real finger), or a contenteditable's editing host.
 *
 * @param node - the node (a contenteditable's text, for one).
 * @returns the field; none when the node is in no such field.
 */
export const editableFieldOf = (node: Node): HTMLElement | undefined => {
  const element = node instanceof Element ? node : node.parentElement;
  if (!(element instanceof HTMLElement)) return undefined;
  if (element instanceof HTMLTextAreaElement) return element.matches(":disabled") ? undefined : element;
  if (element instanceof HTMLInputElement)
    return CARET_INPUT_TYPES.has(element.type) && !element.matches(":disabled") ? element : undefined;
  if (!element.isContentEditable) return undefined;
  // only the editing host takes the focus: what is inside it is edited through it
  let host = element;
  while (host.parentElement?.isContentEditable === true) host = host.parentElement;
  return host;
};

/**
 * The element under a point, inside the open shadow roots on the way (`elementFromPoint` stops at their hosts).
 *
 * @param document - the frame's document.
 * @param point - the point.
 */
export const deepElementAt = (document: Document, point: Point): Element | undefined => {
  let element = document.elementFromPoint(point.x, point.y);
  while (element?.shadowRoot) {
    const inner: Element | null = element.shadowRoot.elementFromPoint(point.x, point.y);
    if (inner === null || inner === element) break;
    element = inner;
  }
  return element ?? undefined;
};

/**
 * The shadow roots a field is inside: the caret's lookup does not enter one it is not given.
 *
 * @param field - the field.
 */
const shadowRootsAround = (field: HTMLElement): ShadowRoot[] => {
  const roots: ShadowRoot[] = [];
  let root = field.getRootNode();
  while (root instanceof ShadowRoot) {
    roots.push(root);
    root = root.host.getRootNode();
  }
  return roots;
};

/**
 * Where the browser would put the caret at a point, when that is in the field.
 *
 * @param document - the frame's document.
 * @param point - the point.
 * @param field - the field.
 * @returns the place; none when the browser cannot tell.
 */
const caretSpotAt = (document: Document, point: Point, field: HTMLElement): CaretSpot | undefined => {
  let spot: CaretSpot | undefined;
  if (typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(point.x, point.y, {
      shadowRoots: shadowRootsAround(field)
    });
    if (position !== null) spot = { node: position.offsetNode, offset: position.offset };
  } else if (!isTextControl(field)) {
    const range = document.caretRangeFromPoint(point.x, point.y);
    if (range !== null) spot = { node: range.startContainer, offset: range.startOffset };
  }
  return spot !== undefined && field.contains(spot.node) ? spot : undefined;
};

/**
 * Puts the caret in an input or a textarea, at the end without an offset.
 *
 * @param document - the frame's document.
 * @param control - the field, focused.
 * @param offset - how far into its value.
 */
const placeInControl = (document: Document, control: TextControl, offset: number | undefined): void => {
  if (control.selectionStart !== null) {
    const place = offset ?? control.value.length;
    control.setSelectionRange(place, place);
    return;
  }
  // an email or a number field has no selection range to set, but the document's selection walks through it, focused:
  // it lands on the place in Chromium and WebKit, not in Firefox
  const selection = document.getSelection();
  if (selection === null) return;
  if (offset === undefined) {
    selection.modify("move", "forward", "lineboundary");
    return;
  }
  selection.modify("move", "backward", "lineboundary");
  // the offset counts UTF-16 code units, the steps whole characters
  const before = control.value.slice(0, offset);
  const steps = Array.from(new Intl.Segmenter().segment(before)).length;
  for (let step = 0; step < steps; step += 1) selection.modify("move", "forward", "character");
};

/**
 * Puts the caret in a contenteditable, at its end without a place.
 *
 * @param document - the frame's document.
 * @param host - the editing host, focused.
 * @param spot - the place.
 */
const placeInEditable = (document: Document, host: HTMLElement, spot: CaretSpot | undefined): void => {
  const selection = document.getSelection();
  if (selection === null) return;
  // the spot was read before the focus: a focus handler may have changed the text since
  if (spot !== undefined && host.contains(spot.node)) {
    const { node } = spot;
    const length = node instanceof CharacterData ? node.length : node.childNodes.length;
    selection.collapse(node, Math.min(spot.offset, length));
    return;
  }
  selection.selectAllChildren(host);
  selection.collapseToEnd();
};

/**
 * Whether a field holds the focus: a story's focus handler may have moved it on.
 *
 * @param field - the field.
 */
const holdsFocus = (field: HTMLElement): boolean => {
  const root = field.getRootNode();
  return (root instanceof Document || root instanceof ShadowRoot) && root.activeElement === field;
};

/**
 * A tap lands at a point: the editable field under it, if any, takes the focus and the caret.
 *
 * @param document - the frame's document.
 * @param point - where the finger tapped.
 */
export const tapField = (document: Document, point: Point): void => {
  const element = deepElementAt(document, point);
  const field = element === undefined ? undefined : editableFieldOf(element);
  if (field === undefined) return;
  // read before the focus, which may scroll a long field's text from under the finger
  const spot = caretSpotAt(document, point, field);
  field.focus();
  if (!holdsFocus(field)) return;
  if (isTextControl(field)) placeInControl(document, field, spot?.offset);
  else placeInEditable(document, field, spot);
};

/**
 * A tap's click reached a label: the editable field it names takes the focus, which a dispatched click does not give it.
 * The caret stays where the field had it, as under a real finger. A tap on what is interactive inside the label (the
 * field itself, a button) does not activate the label.
 *
 * @param origin - where the click began, inside any shadow root.
 */
export const tapLabel = (origin: EventTarget | undefined): void => {
  if (!(origin instanceof Element)) return;
  const label = origin.closest("label");
  if (label === null) return;
  const interactive = origin.closest(LABEL_INTERACTIVE);
  if (interactive !== null && label.contains(interactive)) return;
  const { control } = label;
  if (control instanceof HTMLElement && editableFieldOf(control) !== undefined) control.focus();
};
