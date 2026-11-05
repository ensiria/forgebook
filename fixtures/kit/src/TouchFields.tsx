/**
 * Editable fields for the catalogue's touch tests: each kind a finger can put a caret in, in a fixed-width font so a test
 * can reckon which character it taps, the ones a caret has no place in, and the ones whose handlers cancel the tap.
 *
 * @module
 */
import "./touchFields.scss";

import { type ReactNode, type SyntheticEvent, useEffect, useRef, useState } from "react";

/** What every field holds: each character tells its own place. */
const DIGITS = "0123456789abcdefghij";

/** The events the log lists, seen before the fields' own handlers. */
const LOGGED: readonly string[] = [
  "pointerdown",
  "touchstart",
  "pointerup",
  "touchend",
  "mousedown",
  "focusin",
  "mouseup",
  "click",
  "contextmenu"
];

/** Cancels an event, as a story's handler may. */
const cancel = (event: SyntheticEvent): void => event.preventDefault();

/** Shortens a field's text as it takes the focus, as a story's handler may. */
const shrink = (event: Event): void => {
  const text = event.target instanceof Element ? event.target.firstChild : null;
  if (text instanceof Text) text.data = "01";
};

/** The caret's fields inside a shadow root, as a web component holds them. */
const ShadowFields = (): ReactNode => {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (element === null || element.shadowRoot !== null) return;
    const root = element.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = "input, div { display: block; width: 30ch; padding: 0; border: 0; font: inherit; }";
    const input = document.createElement("input");
    input.ariaLabel = "Shadow input";
    input.value = DIGITS;
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    editable.dataset["testid"] = "shadow-editable";
    editable.textContent = DIGITS;
    const label = document.createElement("label");
    label.htmlFor = "shadow-labelled";
    label.textContent = "A shadow label";
    const labelled = document.createElement("input");
    labelled.id = "shadow-labelled";
    labelled.dataset["testid"] = "shadow-labelled";
    root.append(style, input, editable, label, labelled);
  }, []);
  return <div ref={host} data-testid="shadow-fields" />;
};

/**
 * Lists what reaches the fields.
 */
export const TouchFields = (): ReactNode => {
  const [text, setText] = useState(DIGITS);
  const [log, setLog] = useState<readonly string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (element === null) return undefined;
    const note = (event: Event): void => {
      const kind = event instanceof PointerEvent ? ` ${event.pointerType}` : "";
      setLog((current) => [...current, `${event.type}${kind}`].slice(-12));
    };
    for (const type of LOGGED) element.addEventListener(type, note, { capture: true });
    return (): void => {
      for (const type of LOGGED) element.removeEventListener(type, note, { capture: true });
    };
  }, []);
  return (
    <div className="touch-fields" ref={root}>
      <input aria-label="Text" value={text} onChange={(event) => setText(event.target.value)} />
      <textarea aria-label="Textarea" rows={2} defaultValue={`${DIGITS}\n${DIGITS}`} />
      <div
        data-testid="editable"
        className="touch-fields__editable"
        contentEditable
        suppressContentEditableWarning
      >
        {DIGITS}
      </div>
      <div
        data-testid="editable-marks"
        className="touch-fields__editable"
        contentEditable
        suppressContentEditableWarning
      >
        01234<b>56789</b>
        <span contentEditable={false}>abcde</span>fghij
      </div>
      <input aria-label="Email" type="email" defaultValue={DIGITS} />
      <input aria-label="Number" type="number" defaultValue="1234567890" />
      <input aria-label="Read only" readOnly defaultValue={DIGITS} />
      <input aria-label="Disabled" disabled defaultValue={DIGITS} />
      <input aria-label="Long" defaultValue={DIGITS.repeat(20)} />
      <input aria-label="Cancels pointerdown" defaultValue={DIGITS} onPointerDown={cancel} />
      <input aria-label="Cancels mousedown" defaultValue={DIGITS} onMouseDown={cancel} />
      <input aria-label="Cancels touchend" defaultValue={DIGITS} onTouchEnd={cancel} />
      <label>
        Wrapped <input data-testid="wrapped" defaultValue={DIGITS} onPointerDown={cancel} />
      </label>
      <div
        className="touch-fields__editable"
        contentEditable
        suppressContentEditableWarning
        data-testid="editable-shrinks"
        ref={(element) => element?.addEventListener("focus", shrink)}
      >
        {DIGITS}
      </div>
      <input aria-label="Checkbox" type="checkbox" />
      <input aria-label="Range" type="range" />
      <button type="button">Button</button>
      <label htmlFor="touch-fields-labelled">A label</label>
      <input id="touch-fields-labelled" aria-label="Labelled" defaultValue={DIGITS} />
      <p data-testid="plain">Plain text a finger does not select</p>
      <ShadowFields />
      <ul aria-label="Field events">
        {log.map((entry, index) => (
          // the log only grows at its end
          // biome-ignore lint/suspicious/noArrayIndexKey: the entries repeat, and only their order matters
          <li key={index}>{entry}</li>
        ))}
      </ul>
    </div>
  );
};
