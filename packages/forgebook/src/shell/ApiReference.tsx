/**
 * The API reference on a component's page: its props and its events, drawn from its types and TSDoc, as a table
 * (prop, type, default, what it does), never written by hand, then the same for each part the meta names in
 * `subcomponents`. The table scrolls sideways on its own when the page is narrower than it.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { ComponentDocs, PropDocs, SubcomponentDocs } from "../componentDocs.ts";
import { Code } from "./Code.tsx";
import { CodeText } from "./CodeText.tsx";
import { SignatureReference } from "./SignatureReference.tsx";
import { STRINGS } from "./strings.ts";

/** A prop's or an event's type as one line of TypeScript: an event's signature as an arrow. */
const typeText = (prop: PropDocs): string =>
  prop.signature === undefined
    ? prop.type
    : `(${prop.signature.parameters.map((parameter) => `${parameter.name}: ${parameter.type}`).join(", ")}) => ${prop.signature.returns}`;

/**
 * A table of props or events: the Default column only when one of them has a default.
 *
 * @param props - the props or the events, which of the two they are, and the part they belong to: each row says its name, for an address to open it.
 */
const PropTable = ({
  props,
  isEvents,
  part
}: {
  readonly props: readonly PropDocs[];
  readonly isEvents: boolean;
  readonly part: string | undefined;
}): ReactNode => {
  const hasDefaults = !isEvents && props.some((prop) => prop.defaultValue !== undefined);
  return (
    <div className="forgebook-api">
      <table className="forgebook-api__table">
        <thead>
          <tr>
            <th scope="col">{isEvents ? STRINGS.apiEvent : STRINGS.apiProp}</th>
            <th scope="col">{isEvents ? STRINGS.apiSignature : STRINGS.apiType}</th>
            {hasDefaults ? <th scope="col">{STRINGS.apiDefault}</th> : null}
            <th scope="col">{STRINGS.apiWhat}</th>
          </tr>
        </thead>
        <tbody>
          {props.map((prop) => (
            <tr key={prop.name} data-prop={part === undefined ? prop.name : `${part}.${prop.name}`}>
              <th scope="row">
                <code className="forgebook-api__name">{prop.name}</code>
                {prop.isRequired ? (
                  <span className="forgebook-prop__required" title={STRINGS.required}>
                    *
                  </span>
                ) : null}
              </th>
              <td className="forgebook-api__type">
                <Code
                  text={typeText(prop)}
                  names={prop.signature?.parameters.map((parameter) => parameter.name) ?? []}
                />
              </td>
              {hasDefaults ? (
                <td>
                  {prop.defaultValue === undefined ? null : (
                    <code className="forgebook-inline-code">{prop.defaultValue}</code>
                  )}
                </td>
              ) : null}
              <td>
                <CodeText text={prop.description} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * A component's or a part's props, then its events under their own heading.
 *
 * @param props - the props, the level of the events' heading (under the section's, or under a part's) and the part they belong to.
 */
const PropsAndEvents = ({
  props,
  eventsLevel,
  part
}: {
  readonly props: readonly PropDocs[];
  readonly eventsLevel: 3 | 4;
  readonly part?: string;
}): ReactNode => {
  const EventsHeading = eventsLevel === 3 ? "h3" : "h4";
  const values = props.filter((prop) => prop.kind !== "event");
  const events = props.filter((prop) => prop.kind === "event");
  return (
    <>
      {values.length === 0 ? null : <PropTable props={values} isEvents={false} part={part} />}
      {events.length === 0 ? null : (
        <>
          <EventsHeading>{STRINGS.events}</EventsHeading>
          <PropTable props={events} isEvents={true} part={part} />
        </>
      )}
    </>
  );
};

/**
 * A part's reference: its name, its summary, its props and events.
 *
 * @param props - the part's docs.
 */
const SubcomponentReference = ({ docs }: { readonly docs: SubcomponentDocs }): ReactNode => (
  <section className="forgebook-api__subcomponent" aria-label={docs.name} data-prop={docs.name}>
    <h3>
      <code className="forgebook-inline-code">{docs.name}</code>
    </h3>
    {docs.description === "" ? null : (
      <p>
        <CodeText text={docs.description} />
      </p>
    )}
    <PropsAndEvents props={docs.props} eventsLevel={4} part={docs.name} />
  </section>
);

/**
 * The API reference.
 *
 * @param props - the component's docs, and whether it is a hook's or a function's (its stories are about logic).
 */
export const ApiReference = ({
  docs,
  isLogic
}: {
  readonly docs: ComponentDocs;
  readonly isLogic: boolean;
}): ReactNode => (
  <section className="forgebook-doc__section" aria-labelledby="forgebook-api">
    <h2 id="forgebook-api">{STRINGS.apiReference}</h2>
    {/* a hook's or a function's page documents its call, not the props of a component */}
    {isLogic && docs.signature !== undefined ? (
      <SignatureReference name={docs.name} signature={docs.signature} />
    ) : (
      <PropsAndEvents props={docs.props} eventsLevel={3} />
    )}
    {docs.subcomponents.map((subcomponent) => (
      <SubcomponentReference key={subcomponent.name} docs={subcomponent} />
    ))}
  </section>
);
