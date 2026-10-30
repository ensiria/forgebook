/**
 * The API reference on a component's page: its props and its events, drawn from its types and TSDoc, as a table
 * (prop, type, default, what it does), never written by hand, then the same for each part the meta names in
 * `subcomponents`. The table scrolls sideways on its own when the page is narrower than it.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { ComponentDocs, PropDocs, SubcomponentDocs } from "../componentDocs";
import { Code } from "./Code";
import { CodeText } from "./CodeText";
import { STRINGS } from "./strings";

/** A prop's or an event's type as one line of TypeScript: an event's signature as an arrow. */
const typeText = (prop: PropDocs): string =>
  prop.signature === undefined
    ? prop.type
    : `(${prop.signature.parameters.map((parameter) => `${parameter.name}: ${parameter.type}`).join(", ")}) => ${prop.signature.returns}`;

/**
 * A table of props or events: the Default column only when one of them has a default.
 *
 * @param props - the props or the events, and which of the two they are.
 */
const PropTable = ({
  props,
  isEvents
}: {
  readonly props: readonly PropDocs[];
  readonly isEvents: boolean;
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
            <tr key={prop.name}>
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
 * @param props - the props, and the level of the events' heading: under the section's, or under a part's.
 */
const PropsAndEvents = ({
  props,
  eventsLevel
}: {
  readonly props: readonly PropDocs[];
  readonly eventsLevel: 3 | 4;
}): ReactNode => {
  const EventsHeading = eventsLevel === 3 ? "h3" : "h4";
  const values = props.filter((prop) => prop.kind !== "event");
  const events = props.filter((prop) => prop.kind === "event");
  return (
    <>
      {values.length === 0 ? null : <PropTable props={values} isEvents={false} />}
      {events.length === 0 ? null : (
        <>
          <EventsHeading>{STRINGS.events}</EventsHeading>
          <PropTable props={events} isEvents={true} />
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
  <section className="forgebook-api__subcomponent" aria-label={docs.name}>
    <h3>
      <code className="forgebook-inline-code">{docs.name}</code>
    </h3>
    {docs.description === "" ? null : (
      <p>
        <CodeText text={docs.description} />
      </p>
    )}
    <PropsAndEvents props={docs.props} eventsLevel={4} />
  </section>
);

/**
 * The API reference.
 *
 * @param props - the component's docs.
 */
export const ApiReference = ({ docs }: { readonly docs: ComponentDocs }): ReactNode => (
  <section className="forgebook-doc__section" aria-labelledby="forgebook-api">
    <h2 id="forgebook-api">{STRINGS.apiReference}</h2>
    <PropsAndEvents props={docs.props} eventsLevel={3} />
    {docs.subcomponents.map((subcomponent) => (
      <SubcomponentReference key={subcomponent.name} docs={subcomponent} />
    ))}
  </section>
);
