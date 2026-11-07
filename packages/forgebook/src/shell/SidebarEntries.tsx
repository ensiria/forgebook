/**
 * The sidebar's entries: a family's or a group's fold, a named group under its own button, a component's link and an
 * alias entry for a component listed in another place too.
 *
 * @module
 */
import type { MouseEvent, ReactNode } from "react";

import { isFilterTag } from "../storyTagNames.ts";
import { isLogicComponent, type TreeAlias, type TreeComponent, type TreeGroup } from "../storyTree.ts";
import { Icon } from "./icons.tsx";
import { STRINGS } from "./strings.ts";
import { TagViewSlot } from "./tagView.tsx";
import { useFold } from "./useFold.ts";

/** The shown component: its source and title, to mark it and keep its family open, and the shown story's id. */
export type ShownComponent = {
  /** Its source's id. */
  readonly sourceId: string;
  /** Its title. */
  readonly title: string;
  /** The shown story's id; none on the component's page. */
  readonly storyId: string | undefined;
};

/** How an entry links its page. */
export type SidebarLinks = {
  /** The address of a component's page, by its title, for its link. */
  readonly componentHref: (sourceId: string, title: string) => string;
  /** Opens a component's page, by its title. */
  readonly onOpenComponent: (sourceId: string, title: string) => void;
};

/** A link that opens a page in place, keeping a real address for a new tab. */
export const PageLink = ({
  href,
  className,
  current,
  onOpen,
  children
}: {
  readonly href: string;
  readonly className: string;
  /** What the link is when current: the shown page, or the place the shown page is in; none when not current. */
  readonly current: "page" | "location" | undefined;
  readonly onOpen: () => void;
  readonly children: ReactNode;
}): ReactNode => (
  <a
    className={className}
    href={href}
    aria-current={current}
    onClick={(event: MouseEvent<HTMLAnchorElement>): void => {
      event.preventDefault();
      onOpen();
    }}
  >
    {children}
  </a>
);

/** What the shown component's link is: the page itself on the component's page, where the page is on a story's. */
const currentKind = (currentStoryId: string | undefined): "page" | "location" =>
  currentStoryId === undefined ? "page" : "location";

/**
 * What a family's or a group's button folds open and shut animated: drawn only while open or shutting.
 *
 * @param props - whether it is open, whether it opens at once (a search), and its content, made only when drawn.
 */
export const TreeFold = ({
  isOpen,
  isInstant,
  content
}: {
  readonly isOpen: boolean;
  readonly isInstant: boolean;
  readonly content: () => ReactNode;
}): ReactNode => {
  const { isDrawn, ref } = useFold(isOpen, isInstant);
  return (
    <div ref={ref} className="forgebook-tree__fold">
      {isDrawn ? content() : null}
    </div>
  );
};

/**
 * A group of a family: its components, under a button that folds them when the group has a name (shut by default,
 * open when it holds the shown component), always shown when it has none.
 *
 * @param props - the group, its source, whether it is open and what toggling it does, and the shown page and links.
 */
export const FamilyGroup = ({
  sourceId,
  group,
  isOpen,
  isInstant,
  onToggle,
  current,
  links
}: {
  readonly sourceId: string;
  readonly group: TreeGroup;
  readonly isOpen: boolean;
  readonly isInstant: boolean;
  readonly onToggle: () => void;
  readonly current: ShownComponent | undefined;
  readonly links: SidebarLinks;
}): ReactNode => {
  const entries = (): ReactNode =>
    groupEntries(group).map((entry) =>
      entry.kind === "component" ? (
        <ComponentEntry
          key={entry.component.title}
          sourceId={sourceId}
          component={entry.component}
          isCurrent={current?.sourceId === sourceId && current.title === entry.component.title}
          currentStoryId={current?.storyId}
          links={links}
        />
      ) : (
        <AliasEntry
          key={`alias:${entry.alias.title}`}
          sourceId={sourceId}
          alias={entry.alias}
          links={links}
        />
      )
    );
  if (group.name === undefined) return <div className="forgebook-tree__group">{entries()}</div>;
  return (
    <div className="forgebook-tree__group">
      <h3 className="forgebook-tree__group-name">
        <button
          type="button"
          className="forgebook-tree__group-button"
          aria-expanded={isOpen}
          onClick={onToggle}
        >
          <span className="forgebook-tree__chevron" data-open={isOpen ? "" : undefined}>
            <Icon name="chevronRight" size={12} />
          </span>
          <span className="forgebook-tree__family-name">{group.name}</span>
          {group.components.length > 0 ? (
            <span className="forgebook-tree__count">{group.components.length}</span>
          ) : null}
        </button>
      </h3>
      <TreeFold isOpen={isOpen} isInstant={isInstant} content={entries} />
    </div>
  );
};

/** A component's link: its page, where its stories are picked from the header, with its status's badges. */
const ComponentEntry = ({
  sourceId,
  component,
  isCurrent,
  currentStoryId,
  links
}: {
  readonly sourceId: string;
  readonly component: TreeComponent;
  readonly isCurrent: boolean;
  readonly currentStoryId: string | undefined;
  readonly links: SidebarLinks;
}): ReactNode => {
  const current = isCurrent ? currentKind(currentStoryId) : undefined;
  return (
    <div className="forgebook-tree__component">
      <PageLink
        href={links.componentHref(sourceId, component.title)}
        className="forgebook-tree__item"
        current={current}
        onOpen={(): void => links.onOpenComponent(sourceId, component.title)}
      >
        <span className="forgebook-tree__item-name">{component.name}</span>
        {isLogicComponent(component) ? (
          <span className="forgebook-tree__logic" title={STRINGS.logicHint}>
            <Icon name="function" size={12} />
            <span className="forgebook-visually-hidden">{STRINGS.logic}</span>
          </span>
        ) : null}
        {component.tags.some(isFilterTag) ? <TagViewSlot place="entry" component={component} /> : null}
        <span className="forgebook-tree__count">{component.stories.length}</span>
      </PageLink>
    </div>
  );
};

/** The family a title places a component in: its first segment. */
const familyOf = (title: string): string => title.split("/")[0]?.trim() ?? title;

/**
 * An alias entry: the name of a component that lives elsewhere, marked with the family it lives in, opening its page.
 * It is never marked as the shown page: the entry where the component lives is, so the sidebar says where
 * it sits.
 */
const AliasEntry = ({
  sourceId,
  alias,
  links
}: {
  readonly sourceId: string;
  readonly alias: TreeAlias;
  readonly links: SidebarLinks;
}): ReactNode => (
  <div className="forgebook-tree__component" title={STRINGS.aliasHint(alias.title.split("/").join(" › "))}>
    <PageLink
      href={links.componentHref(sourceId, alias.title)}
      className="forgebook-tree__item"
      current={undefined}
      onOpen={(): void => links.onOpenComponent(sourceId, alias.title)}
    >
      <span className="forgebook-tree__item-name">{alias.name}</span>
      <span className="forgebook-tree__alias">
        <Icon name="external" size={10} />
        {STRINGS.aliasPlace(familyOf(alias.title))}
      </span>
    </PageLink>
  </div>
);

/** A group's entries in name order: its own components and the aliases of components that live elsewhere. */
const groupEntries = (
  group: TreeGroup
): readonly (
  | { readonly kind: "component"; readonly component: TreeComponent }
  | {
      readonly kind: "alias";
      readonly alias: TreeAlias;
    }
)[] =>
  [
    ...group.components.map((component) => ({ kind: "component" as const, component, name: component.name })),
    ...group.aliases.map((alias) => ({ kind: "alias" as const, alias, name: alias.name }))
  ].sort((left, right) => left.name.localeCompare(right.name));
