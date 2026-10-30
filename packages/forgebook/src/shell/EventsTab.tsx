/**
 * The panel's Events tab: each event of the component with its signature highlighted and its description, then the
 * calls the story made, newest first (D-64).
 *
 * @module
 */
import type { ReactNode } from "react";

import type { PropDocs } from "../componentDocs";
import { Code } from "./Code";
import { STRINGS } from "./strings";
import type { EventCall } from "./useFrameMessages";

/** The tab's props. */
export type EventsTabProps = {
  /** The component's events (its `on…` props). */
  readonly events: readonly PropDocs[];
  /** The calls received, newest first. */
  readonly calls: readonly EventCall[];
  /** Clears the calls. */
  readonly onClearCalls: () => void;
};

/** An event's signature as TypeScript would write it. */
const signatureText = (event: PropDocs): string =>
  event.signature === undefined
    ? event.type
    : `(${event.signature.parameters.map((parameter) => `${parameter.name}: ${parameter.type}`).join(", ")}) => ${event.signature.returns}`;

/**
 * One call: the event with its arguments written short, opening on their content when one is an object or a list.
 *
 * @param props - the call.
 */
const CallLine = ({ call }: { readonly call: EventCall }): ReactNode => {
  const line = <Code text={`${call.name}(${call.values.join(", ")})`} names={[call.name]} />;
  const details = call.details.filter((detail): detail is string => detail !== null);
  if (details.length === 0) return line;
  return (
    <details className="forgebook-calls__details">
      <summary>{line}</summary>
      <pre className="forgebook-code-block">
        <Code text={details.join("\n")} names={[]} />
      </pre>
    </details>
  );
};

/**
 * The Events tab.
 *
 * @param props - the events, the calls and how to clear them.
 */
export const EventsTab = ({ events, calls, onClearCalls }: EventsTabProps): ReactNode => (
  <div className="forgebook-tab-columns">
    <div className="forgebook-prop-group">
      <h3 className="forgebook-prop-group__title">{STRINGS.events}</h3>
      {events.map((event) => (
        <div key={event.name} className="forgebook-event">
          <code className="forgebook-prop__name">{event.name}</code>
          <Code
            text={signatureText(event)}
            names={event.signature?.parameters.map((parameter) => parameter.name) ?? []}
          />
          <p className="forgebook-prop__description">{event.description}</p>
        </div>
      ))}
    </div>
    <div className="forgebook-prop-group forgebook-calls">
      <div className="forgebook-calls__head">
        <h3 className="forgebook-prop-group__title">{STRINGS.calls}</h3>
        <button type="button" className="forgebook-text-button" onClick={onClearCalls}>
          {STRINGS.clearCalls}
        </button>
      </div>
      {calls.length === 0 ? <p className="forgebook-prop__description">{STRINGS.noCalls}</p> : null}
      <ol className="forgebook-calls__list" aria-live="polite">
        {calls.map((call) => (
          <li key={`${call.time}-${call.name}-${call.values.join(",")}`} className="forgebook-calls__item">
            <CallLine call={call} />
            <time className="forgebook-calls__time" dateTime={new Date(call.time).toISOString()}>
              {new Date(call.time).toLocaleTimeString()}
            </time>
          </li>
        ))}
      </ol>
    </div>
  </div>
);
