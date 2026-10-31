/**
 * "Used in" on a component's page: the other components of its source whose stories use it, each linking to its page
 * with the stories that use it, direct users first; a reader folds it away and their browser keeps that.
 *
 * @remarks
 * The usage is loaded only while the block is open, so a reader who keeps it shut never makes the catalogue read its
 * import graph. Twelve components show at first, then "and N more" shows the rest. A component used only through
 * another (Tree renders Row, Row renders it) says so.
 *
 * @module
 */
import { type MouseEvent, type ReactNode, useId, useState } from "react";

import type { TreeComponent, TreeStory } from "../storyTree.ts";
import { isUsageIndex, USED_IN_SHOWN, type UsageIndex, type UsingComponent } from "../usedIn.ts";
import { Icon } from "./icons.tsx";
import { STRINGS } from "./strings.ts";
import { useFold } from "./useFold.ts";
import { type Loaded, useLoaded } from "./useLoaded.ts";
import { useStored } from "./useStored.ts";

/** What the block reads and opens. */
export type UsedInProps = {
  /** The page's component's title. */
  readonly title: string;
  /** Loads the source's usage. */
  readonly load: () => Promise<UsageIndex | string>;
  /** A component of the source, by its title; none when the tree no longer has it. */
  readonly componentOf: (title: string) => TreeComponent | undefined;
  /** The address of a component's page. */
  readonly componentHrefOf: (component: TreeComponent) => string;
  /** Opens a component's page. */
  readonly onOpenComponent: (component: TreeComponent) => void;
  /** The address of a story's page. */
  readonly storyHrefOf: (story: TreeStory) => string;
  /** Opens a story's page. */
  readonly onOpenStory: (story: TreeStory) => void;
};

/** A using component as the block shows it: the component and its stories that use the page's. */
type ShownUser = {
  /** The component. */
  readonly component: TreeComponent;
  /** Whether a story of it renders the page's component itself. */
  readonly isDirect: boolean;
  /** Its stories that use the page's component. */
  readonly stories: readonly TreeStory[];
};

/**
 * The using components the tree still has, with their stories.
 *
 * @param users - the using components, by title.
 * @param componentOf - a component by its title.
 */
const shownUsers = (
  users: readonly UsingComponent[],
  componentOf: (title: string) => TreeComponent | undefined
): ShownUser[] =>
  users.flatMap((user) => {
    const component = componentOf(user.title);
    if (component === undefined) return [];
    const stories = user.stories.flatMap((exportName) =>
      component.stories.filter((story) => story.exportName === exportName)
    );
    return [{ component, isDirect: user.isDirect, stories }];
  });

/**
 * A link that opens a page in place, keeping a real address for a new tab.
 *
 * @param props - the address, what opening does, its class and its text.
 */
const PageLink = ({
  href,
  onOpen,
  className,
  children
}: {
  readonly href: string;
  readonly onOpen: () => void;
  readonly className: string;
  readonly children: ReactNode;
}): ReactNode => (
  <a
    className={className}
    href={href}
    onClick={(event: MouseEvent<HTMLAnchorElement>): void => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      onOpen();
    }}
  >
    {children}
  </a>
);

/**
 * The list of using components, twelve first and the rest on request.
 *
 * @param props - the using components and how their pages open.
 */
const UserList = ({
  users,
  ...links
}: Omit<UsedInProps, "title" | "load" | "componentOf"> & {
  readonly users: readonly ShownUser[];
}): ReactNode => {
  const [isAll, setIsAll] = useState(false);
  if (users.length === 0) return <p className="forgebook-used-in__note">{STRINGS.usedInNone}</p>;
  const shown = isAll ? users : users.slice(0, USED_IN_SHOWN);
  return (
    <>
      <ul className="forgebook-used-in__list">
        {shown.map((user) => (
          <li key={user.component.title} className="forgebook-used-in__user">
            <PageLink
              href={links.componentHrefOf(user.component)}
              onOpen={(): void => links.onOpenComponent(user.component)}
              className="forgebook-link forgebook-used-in__component"
            >
              {user.component.name}
            </PageLink>
            <span className="forgebook-used-in__note">
              {user.isDirect ? STRINGS.usedInStories(user.stories.length) : STRINGS.usedInThrough}
            </span>
            <span className="forgebook-used-in__stories">
              {user.stories.map((story) => (
                <PageLink
                  key={story.id}
                  href={links.storyHrefOf(story)}
                  onOpen={(): void => links.onOpenStory(story)}
                  className="forgebook-used-in__story"
                >
                  {story.name}
                </PageLink>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {isAll || users.length <= USED_IN_SHOWN ? null : (
        <button type="button" className="forgebook-text-button" onClick={(): void => setIsAll(true)}>
          {STRINGS.usedInMore(users.length - USED_IN_SHOWN)}
        </button>
      )}
    </>
  );
};

/** What the source's usage answered, as a state. */
const usageState = (value: unknown): Loaded<UsageIndex> => {
  if (typeof value === "string") return { status: "error", message: value };
  return isUsageIndex(value)
    ? { status: "ready", value }
    : { status: "error", message: "The usage has an unexpected shape" };
};

/**
 * The block.
 *
 * @param props - the page's component, the usage's loader and how pages open.
 */
export const UsedIn = ({ title, load, componentOf, ...links }: UsedInProps): ReactNode => {
  const [isOpen, setIsOpen] = useStored(
    "used-in",
    (stored: string | null): boolean => stored !== "closed",
    (open: boolean): string => (open ? "open" : "closed")
  );
  const usage = useLoaded(isOpen ? load : undefined, usageState);
  const fold = useFold(isOpen, false);
  const headingId = useId();
  const bodyId = useId();
  return (
    <section className="forgebook-doc__section forgebook-used-in" aria-labelledby={headingId}>
      <h2 id={headingId} className="forgebook-used-in__heading">
        <button
          type="button"
          className="forgebook-used-in__toggle"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={(): void => setIsOpen(!isOpen)}
        >
          <span className="forgebook-tree__chevron" data-open={isOpen ? "" : undefined}>
            <Icon name="chevronRight" size={14} />
          </span>
          {STRINGS.usedIn}
        </button>
      </h2>
      <div ref={fold.ref} id={bodyId} className="forgebook-used-in__body">
        {fold.isDrawn ? (
          <>
            {usage.status === "loading" ? (
              <p className="forgebook-used-in__note">{STRINGS.usedInLoading}</p>
            ) : null}
            {usage.status === "error" ? <p className="forgebook-used-in__note">{usage.message}</p> : null}
            {usage.status === "ready" ? (
              <UserList users={shownUsers(usage.value[title] ?? [], componentOf)} {...links} />
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
};
