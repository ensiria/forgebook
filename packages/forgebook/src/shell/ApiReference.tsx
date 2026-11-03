/**
 * The API reference on a component's page: its props and its events, drawn from its types and TSDoc, as a table
 * (prop, type, default, what it does), never written by hand, then the same for each part the meta names in
 * `subcomponents`. The table scrolls sideways on its own when the page is narrower than it.
 *
 * @remarks
 * Props whose TSDoc names a group (`@group Selection`) are listed under its heading, after the props that name none
 * (`propGroups.ts`), each open, so a reader may fold one away. A prop whose type is an object the
 * package documents (`texts?: FileFinderTexts`) unfolds in place to list that type's members; they are drawn only
 * once unfolded, so a library with large text types keeps a light page.
 *
 * @module
 */
import { type ReactNode, useState } from "react";

import type { ComponentDocs, MemberDocs, PropDocs, SubcomponentDocs } from "../componentDocs.ts";
import { groupedProps, type PropGroup, propGroupOrder } from "../propGroups.ts";
import { Code } from "./Code.tsx";
import { CodeText } from "./CodeText.tsx";
import { useCatalogue } from "./catalogueContext.ts";
import { Icon } from "./icons.tsx";
import { SignatureReference } from "./SignatureReference.tsx";
import { STRINGS } from "./strings.ts";

/** A row of a table: a prop, an event, or a member of a prop's object type. */
type RowDocs = MemberDocs & Partial<Pick<PropDocs, "signature" | "members">>;

/** What a table lists, which names its first two columns. */
type TableKind = "props" | "events" | "members";

/** A prop's or an event's type as one line of TypeScript: an event's signature as an arrow. */
const typeText = (row: RowDocs): string =>
  row.signature === undefined
    ? row.type
    : `(${row.signature.parameters.map((parameter) => `${parameter.name}: ${parameter.type}`).join(", ")}) => ${row.signature.returns}`;

/** A table's first column's heading. */
const NAME_HEADINGS: Readonly<Record<TableKind, () => string>> = {
  props: () => STRINGS.apiProp,
  events: () => STRINGS.apiEvent,
  members: () => STRINGS.apiMember
};

/**
 * One row, and under it, once unfolded, the members of its object type across the whole table.
 *
 * @param props - the row, whether the table has a Default column, its number of columns, and the part it belongs to:
 * the row says its name (`data-prop`), for an address to open it.
 */
const Row = ({
  row,
  hasDefaults,
  columns,
  part
}: {
  readonly row: RowDocs;
  readonly hasDefaults: boolean;
  readonly columns: number;
  readonly part: string | undefined;
}): ReactNode => {
  const [isOpen, setOpen] = useState(false);
  const { members } = row;
  return (
    <>
      <tr data-prop={part === undefined ? row.name : `${part}.${row.name}`}>
        <th scope="row">
          <code className="forgebook-api__name">{row.name}</code>
          {row.isRequired ? (
            <span className="forgebook-prop__required" title={STRINGS.required}>
              *
            </span>
          ) : null}
        </th>
        <td className="forgebook-api__type">
          <Code
            text={typeText(row)}
            names={row.signature?.parameters.map((parameter) => parameter.name) ?? []}
          />
          {members === undefined ? null : (
            <button
              type="button"
              className="forgebook-api__members-toggle"
              aria-expanded={isOpen}
              aria-label={`${STRINGS.membersOf(row.type)}: ${STRINGS.memberCount(members.length)}`}
              onClick={(): void => setOpen(!isOpen)}
            >
              <Icon name="chevronRight" size={12} />
              {STRINGS.memberCount(members.length)}
            </button>
          )}
        </td>
        {hasDefaults ? (
          <td>
            {row.defaultValue === undefined ? null : (
              <code className="forgebook-inline-code">{row.defaultValue}</code>
            )}
          </td>
        ) : null}
        <td>
          <CodeText text={row.description} />
        </td>
      </tr>
      {members !== undefined && isOpen ? (
        <tr className="forgebook-api__members">
          <td colSpan={columns}>
            <PropTable
              rows={members}
              kind="members"
              label={STRINGS.membersOf(row.type)}
              part={part === undefined ? row.name : `${part}.${row.name}`}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
};

/**
 * A table of props, events or members: the Default column only when one of them has a default.
 *
 * @param props - the rows, what they are, the table's name when it needs one (a members table), and the part they
 * belong to.
 */
const PropTable = ({
  rows,
  kind,
  label,
  part
}: {
  readonly rows: readonly RowDocs[];
  readonly kind: TableKind;
  readonly label?: string;
  readonly part: string | undefined;
}): ReactNode => {
  const hasDefaults = kind !== "events" && rows.some((row) => row.defaultValue !== undefined);
  return (
    <div className="forgebook-api">
      <table className="forgebook-api__table" aria-label={label}>
        <thead>
          <tr>
            <th scope="col">{NAME_HEADINGS[kind]()}</th>
            <th scope="col">{kind === "events" ? STRINGS.apiSignature : STRINGS.apiType}</th>
            {hasDefaults ? <th scope="col">{STRINGS.apiDefault}</th> : null}
            <th scope="col">{STRINGS.apiWhat}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Row
              key={row.name}
              row={row}
              hasDefaults={hasDefaults}
              columns={hasDefaults ? 4 : 3}
              part={part}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * A group of props: the props that name none as a table alone, a named group under its heading, open until a reader
 * folds it.
 *
 * @param props - the group, the level of its heading, and the part it belongs to.
 */
const GroupTable = ({
  group,
  level,
  part
}: {
  readonly group: PropGroup<PropDocs>;
  readonly level: 3 | 4;
  readonly part: string | undefined;
}): ReactNode => {
  if (group.name === undefined) return <PropTable rows={group.props} kind="props" part={part} />;
  const Heading = level === 3 ? "h3" : "h4";
  return (
    <details className="forgebook-fold forgebook-api__group" open>
      <summary className="forgebook-fold__summary">
        <Icon name="chevronRight" size={14} />
        <Heading className="forgebook-fold__name">{group.name}</Heading>
        <span className="forgebook-fold__count">{STRINGS.propCount(group.props.length)}</span>
      </summary>
      <PropTable rows={group.props} kind="props" part={part} />
    </details>
  );
};

/**
 * A component's or a part's props in their groups, then its events under their own heading.
 *
 * @param props - the props, the groups to list first, the level of the headings (under the section's, or under a
 * part's) and the part they belong to.
 */
const PropsAndEvents = ({
  props,
  groupOrder,
  level,
  part
}: {
  readonly props: readonly PropDocs[];
  readonly groupOrder: readonly string[];
  readonly level: 3 | 4;
  readonly part?: string;
}): ReactNode => {
  const EventsHeading = level === 3 ? "h3" : "h4";
  const groups = groupedProps(
    props.filter((prop) => prop.kind !== "event"),
    groupOrder
  );
  const events = props.filter((prop) => prop.kind === "event");
  return (
    <>
      {groups.map((group) => (
        <GroupTable key={group.name ?? ""} group={group} level={level} part={part} />
      ))}
      {events.length === 0 ? null : (
        <>
          <EventsHeading>{STRINGS.events}</EventsHeading>
          <PropTable rows={events} kind="events" part={part} />
        </>
      )}
    </>
  );
};

/**
 * A part's reference: its name, its summary, its props and events.
 *
 * @param props - the part's docs, and the groups to list first.
 */
const SubcomponentReference = ({
  docs,
  groupOrder
}: {
  readonly docs: SubcomponentDocs;
  readonly groupOrder: readonly string[];
}): ReactNode => (
  <section className="forgebook-api__subcomponent" aria-label={docs.name} data-prop={docs.name}>
    <h3>
      <code className="forgebook-inline-code">{docs.name}</code>
    </h3>
    {docs.description === "" ? null : (
      <p>
        <CodeText text={docs.description} />
      </p>
    )}
    <PropsAndEvents props={docs.props} groupOrder={groupOrder} level={4} part={docs.name} />
  </section>
);

/** No group named first. */
const NO_GROUPS: readonly string[] = [];

/**
 * The API reference.
 *
 * @param props - the component's docs, whether it is a hook's or a function's (its stories are about logic), and the
 * prop groups its meta lists first, in order (`parameters.propGroups`), ahead of the catalogue's; none by default.
 */
export const ApiReference = ({
  docs,
  isLogic,
  componentGroups = NO_GROUPS
}: {
  readonly docs: ComponentDocs;
  readonly isLogic: boolean;
  readonly componentGroups?: readonly string[];
}): ReactNode => {
  const groupOrder = propGroupOrder(componentGroups, useCatalogue().propGroups);
  return (
    <section className="forgebook-doc__section" aria-labelledby="forgebook-api">
      <h2 id="forgebook-api">{STRINGS.apiReference}</h2>
      {/* a hook's or a function's page documents its call, not the props of a component */}
      {isLogic && docs.signature !== undefined ? (
        <SignatureReference name={docs.name} signature={docs.signature} />
      ) : (
        <PropsAndEvents props={docs.props} groupOrder={groupOrder} level={3} />
      )}
      {docs.subcomponents.map((subcomponent) => (
        <SubcomponentReference key={subcomponent.name} docs={subcomponent} groupOrder={groupOrder} />
      ))}
    </section>
  );
};
