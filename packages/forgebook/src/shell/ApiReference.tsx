/**
 * The API reference on a component's page: its props and its events, drawn from its types and TSDoc, as a table
 * (prop, type, default, what it does), never written by hand, then the same for each part the meta names in
 * `subcomponents`. The table scrolls sideways on its own when the page is narrower than it.
 *
 * @remarks
 * Props whose TSDoc names a group (`@group Selection`) are listed under its heading, after the props that name none
 * (`propGroups.ts`), each open, so a reader may fold one away. The required props come first in each group and among
 * the events, or in one "Required" section before the groups, each naming its group, as the component, the catalogue
 * and the reader's switch in the header say (`useRequiredFirst.ts`). A prop whose type is an object the
 * package documents (`texts?: FileFinderTexts`) unfolds in place to list that type's members; they are drawn only
 * once unfolded, so a library with large text types keeps a light page.
 *
 * @module
 */
import type { RequiredFirst } from "@forgebook/story-format/csf";
import { type ReactNode, useState } from "react";

import type { ComponentDocs, MemberDocs, PropDocs, SubcomponentDocs } from "../componentDocs.ts";
import { canOrderRequired, laidOutProps, type PropGroup, propGroupOrder } from "../propGroups.ts";
import { Code } from "./Code.tsx";
import { CodeText } from "./CodeText.tsx";
import { useCatalogue } from "./catalogueContext.ts";
import { Icon } from "./icons.tsx";
import { LATER_STRINGS } from "./laterStrings.ts";
import { RequiredFirstSwitch } from "./RequiredFirstSwitch.tsx";
import { SignatureReference } from "./SignatureReference.tsx";
import { STRINGS } from "./strings.ts";
import { useRequiredFirst } from "./useRequiredFirst.ts";

/** A row of a table: a prop, an event, or a member of a prop's object type. */
type RowDocs = MemberDocs & Partial<Pick<PropDocs, "signature" | "members" | "group">>;

/** What a table lists, which names its first two columns. */
type TableKind = "props" | "events" | "members";

/** A prop's or an event's type as one line of TypeScript: an event's signature as an arrow. */
const typeText = (row: RowDocs): string =>
  row.signature === undefined
    ? row.type
    : `(${row.signature.parameters.map((parameter) => `${parameter.name}: ${parameter.type}`).join(", ")}) => ${row.signature.returns}`;

/** A table's first column's heading. */
const NAME_HEADINGS: Readonly<Record<TableKind, () => string>> = {
  props: () => LATER_STRINGS.apiProp,
  events: () => LATER_STRINGS.apiEvent,
  members: () => LATER_STRINGS.apiMember
};

/**
 * Where a row of the "Required" section comes from, beside its name: "Event" for an event, which the section gathers
 * with the props, else its group, when it names one.
 *
 * @param props - the row.
 */
const RowPlace = ({ row }: { readonly row: RowDocs }): ReactNode => {
  const place = row.signature === undefined ? row.group : LATER_STRINGS.apiEvent;
  return place === undefined ? null : <span className="forgebook-prop__group">{place}</span>;
};

/**
 * One row, and under it, once unfolded, the members of its object type across the whole table.
 *
 * @param props - the row, whether the table has a Default column, its number of columns, the part it belongs to (the
 * row says its name, `data-prop`, for an address to open it), and whether it names its group (in "Required").
 */
const Row = ({
  row,
  hasDefaults,
  columns,
  part,
  showsGroup
}: {
  readonly row: RowDocs;
  readonly hasDefaults: boolean;
  readonly columns: number;
  readonly part: string | undefined;
  readonly showsGroup: boolean;
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
          {showsGroup ? <RowPlace row={row} /> : null}
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
              aria-label={`${LATER_STRINGS.membersOf(row.type)}: ${LATER_STRINGS.memberCount(members.length)}`}
              onClick={(): void => setOpen(!isOpen)}
            >
              <Icon name="chevronRight" size={12} />
              {LATER_STRINGS.memberCount(members.length)}
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
              label={LATER_STRINGS.membersOf(row.type)}
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
 * @param props - the rows, what they are, the table's name when it needs one (a members table), the part they
 * belong to, and whether each names its group (the "Required" section).
 */
const PropTable = ({
  rows,
  kind,
  label,
  part,
  showsGroups = false
}: {
  readonly rows: readonly RowDocs[];
  readonly kind: TableKind;
  readonly label?: string;
  readonly part: string | undefined;
  readonly showsGroups?: boolean;
}): ReactNode => {
  const hasDefaults = kind !== "events" && rows.some((row) => row.defaultValue !== undefined);
  return (
    <div className="forgebook-api">
      <table className="forgebook-api__table" aria-label={label}>
        <thead>
          <tr>
            <th scope="col">{NAME_HEADINGS[kind]()}</th>
            <th scope="col">{kind === "events" ? LATER_STRINGS.apiSignature : STRINGS.apiType}</th>
            {hasDefaults ? <th scope="col">{LATER_STRINGS.apiDefault}</th> : null}
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
              showsGroup={showsGroups}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * A group of props: the props that name none as a table alone, a named group under its heading, open until a reader
 * folds it. The "Required" section is drawn as a group, each of its props naming its own.
 *
 * @param props - the group, the level of its heading, the part it belongs to, and whether it is the "Required"
 * section.
 */
const GroupTable = ({
  group,
  level,
  part,
  isRequired = false
}: {
  readonly group: PropGroup<PropDocs>;
  readonly level: 3 | 4;
  readonly part: string | undefined;
  readonly isRequired?: boolean;
}): ReactNode => {
  if (group.name === undefined) return <PropTable rows={group.props} kind="props" part={part} />;
  const Heading = level === 3 ? "h3" : "h4";
  return (
    <details className="forgebook-fold forgebook-api__group" data-required={isRequired || undefined} open>
      <summary className="forgebook-fold__summary">
        <Icon name="chevronRight" size={14} />
        <Heading className="forgebook-fold__name">{group.name}</Heading>
        <span className="forgebook-fold__count">{STRINGS.propCount(group.props.length)}</span>
      </summary>
      <PropTable rows={group.props} kind="props" part={part} showsGroups={isRequired} />
    </details>
  );
};

/**
 * A component's or a part's props in their groups, then its events under their own heading, the required ones where
 * the layout puts them.
 *
 * @param props - the props, the groups to list first, the layout of the required props, the level of the headings
 * (under the section's, or under a part's) and the part they belong to.
 */
const PropsAndEvents = ({
  props,
  groupOrder,
  layout,
  level,
  part
}: {
  readonly props: readonly PropDocs[];
  readonly groupOrder: readonly string[];
  readonly layout: RequiredFirst;
  readonly level: 3 | 4;
  readonly part?: string;
}): ReactNode => {
  const EventsHeading = level === 3 ? "h3" : "h4";
  const { required, groups, events } = laidOutProps(props, groupOrder, layout);
  return (
    <>
      {required.length === 0 ? null : (
        <GroupTable
          group={{ name: STRINGS.required, props: required }}
          level={level}
          part={part}
          isRequired={true}
        />
      )}
      {groups.map((group) => (
        <GroupTable key={group.name ?? ""} group={group} level={level} part={part} />
      ))}
      {events.length === 0 ? null : (
        <>
          <EventsHeading>{LATER_STRINGS.events}</EventsHeading>
          <PropTable rows={events} kind="events" part={part} />
        </>
      )}
    </>
  );
};

/**
 * A part's reference: its name, its summary, its props and events.
 *
 * @param props - the part's docs, the groups to list first, and the layout of the required props.
 */
const SubcomponentReference = ({
  docs,
  groupOrder,
  layout
}: {
  readonly docs: SubcomponentDocs;
  readonly groupOrder: readonly string[];
  readonly layout: RequiredFirst;
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
    <PropsAndEvents props={docs.props} groupOrder={groupOrder} layout={layout} level={4} part={docs.name} />
  </section>
);

/** No group named first. */
const NO_GROUPS: readonly string[] = [];

/**
 * The API reference.
 *
 * @param props - the component's docs, whether it is a hook's or a function's (its stories are about logic), the
 * prop groups its meta lists first, in order (`parameters.propGroups`), ahead of the catalogue's, none by default;
 * and where its meta puts the required props (`parameters.requiredFirst`), none for the catalogue's.
 */
export const ApiReference = ({
  docs,
  isLogic,
  componentGroups = NO_GROUPS,
  requiredFirst
}: {
  readonly docs: ComponentDocs;
  readonly isLogic: boolean;
  readonly componentGroups?: readonly string[];
  readonly requiredFirst?: RequiredFirst | undefined;
}): ReactNode => {
  const groupOrder = propGroupOrder(componentGroups, useCatalogue().propGroups);
  const ordering = useRequiredFirst(requiredFirst);
  // a hook's or a function's page documents its call, not the props of a component
  const isSignature = isLogic && docs.signature !== undefined;
  const shown = [
    ...(isSignature ? [] : docs.props),
    ...docs.subcomponents.flatMap((subcomponent) => subcomponent.props)
  ];
  return (
    <section className="forgebook-doc__section" aria-labelledby="forgebook-api">
      <div className="forgebook-api__head">
        <h2 id="forgebook-api">{LATER_STRINGS.apiReference}</h2>
        {canOrderRequired(shown) ? <RequiredFirstSwitch state={ordering} /> : null}
      </div>
      {isSignature ? (
        <SignatureReference name={docs.name} signature={docs.signature} />
      ) : (
        <PropsAndEvents props={docs.props} groupOrder={groupOrder} layout={ordering.layout} level={3} />
      )}
      {docs.subcomponents.map((subcomponent) => (
        <SubcomponentReference
          key={subcomponent.name}
          docs={subcomponent}
          groupOrder={groupOrder}
          layout={ordering.layout}
        />
      ))}
    </section>
  );
};
