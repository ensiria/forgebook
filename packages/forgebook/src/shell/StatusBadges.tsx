/**
 * The statuses' badges: in a component's entry of the sidebar, at the top of its page, beside a story's example that
 * holds a status of its own, and in the tag filter's list.
 * Loaded with the tag filter (`TagViews.tsx`), only for a catalogue whose stories have tags.
 *
 * @remarks
 * A badge says its status in words, so its colour is never the only sign; a hidden word before the badges tells a
 * screen reader what they are. A page whose component is `@deprecated` in its TSDoc shows the `deprecated` badge even
 * when its meta has no such tag, with the TSDoc's reason in its tooltip, so the page never says less than the docs.
 *
 * @module
 */
import { type ReactNode, useMemo } from "react";

import { type CatalogueStatus, catalogueStatuses, DEPRECATED_STATUS, statusesOf } from "../storyStatuses.ts";
import type { TreeComponent } from "../storyTree.ts";
import "./statusBadges.scss";

import { useCatalogue } from "./catalogueContext.ts";
import { textsOfGroup } from "./strings.ts";
import { useComponentDocs } from "./useComponentDocs.ts";

/** The badges' texts, as shown: Forgebook's, with the catalogue's replacements (`strings: { "statuses.review": … }`). */
const STATUS_TEXTS = textsOfGroup("statuses", {
  status: "Status",
  review: "Review",
  experimental: "Experimental",
  deprecated: "Deprecated",
  fromDocs: (reason: string): string => `Deprecated in its TSDoc: ${reason}`
});

/**
 * A status's text: the catalogue's label, else Forgebook's word for a default status, else its tag.
 *
 * @param status - the status.
 */
export const statusLabel = (status: CatalogueStatus): string => {
  if (status.label !== undefined) return status.label;
  if (status.id === "review" || status.id === "experimental" || status.id === "deprecated")
    return STATUS_TEXTS[status.id];
  return status.id;
};

/**
 * One badge.
 *
 * @param props - the status, and the tooltip it carries when there is more to say.
 */
export const StatusBadge = ({
  status,
  hint
}: {
  readonly status: CatalogueStatus;
  readonly hint?: string | undefined;
}): ReactNode => (
  // the tooltip gives a label the sidebar cuts in full
  <span className="forgebook-status" data-tone={status.tone} title={hint ?? statusLabel(status)}>
    {statusLabel(status)}
  </span>
);

/**
 * A row of badges, with the hidden word that says what they are; nothing for none.
 *
 * @param props - the statuses, the tooltip of each by id, and the row's class.
 */
const Badges = ({
  statuses,
  hints,
  className
}: {
  readonly statuses: readonly CatalogueStatus[];
  readonly hints?: Readonly<Record<string, string>>;
  readonly className: string;
}): ReactNode =>
  statuses.length === 0 ? null : (
    <span className={className}>
      <span className="forgebook-visually-hidden">{STATUS_TEXTS.status}: </span>
      {statuses.map((status) => (
        <StatusBadge key={status.id} status={status} hint={hints?.[status.id]} />
      ))}
    </span>
  );

/**
 * The catalogue's statuses, their defaults filled in, once per declaration.
 */
export const useStatuses = (): readonly CatalogueStatus[] => {
  const { statuses } = useCatalogue();
  return useMemo(() => catalogueStatuses(statuses), [statuses]);
};

/**
 * The badges of the statuses a list of tags holds; nothing for none.
 *
 * @param props - the tags, and the row's class.
 */
export const StatusBadges = ({
  tags,
  className
}: {
  readonly tags: readonly string[];
  readonly className: string;
}): ReactNode => <Badges className={className} statuses={statusesOf(tags, useStatuses())} />;

/**
 * The badges at the top of a component's page: its meta's statuses, and `deprecated` when its TSDoc says so, with the
 * TSDoc's reason in that badge's tooltip.
 *
 * @param props - the component and its docs loader.
 */
export const ComponentBadges = ({
  component,
  loadDocs
}: {
  readonly component: TreeComponent;
  readonly loadDocs: (() => Promise<unknown>) | undefined;
}): ReactNode => {
  const statuses = useStatuses();
  const docs = useComponentDocs(loadDocs);
  const reason = docs.status === "ready" ? docs.value.guidance?.deprecated : undefined;
  const { tags } = component;
  return (
    <Badges
      className="forgebook-status-badges forgebook-status-badges--page"
      statuses={statusesOf(reason === undefined ? tags : [...tags, DEPRECATED_STATUS], statuses)}
      hints={reason === undefined ? {} : { [DEPRECATED_STATUS]: STATUS_TEXTS.fromDocs(reason) }}
    />
  );
};
