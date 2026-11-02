/**
 * `next/link` in a catalogue: an anchor whose click moves the story's route, as Next.js's moves the app's, instead of
 * loading another page in the story's frame.
 *
 * @remarks
 * It renders what Next.js's `Link` renders, an `<a>` with the href (the base path before it) and the props given, so
 * a story looks as the app does. A click that the browser should handle (another tab, a download, another origin, a
 * handler that prevented it) is left to the browser, as Next.js leaves it. Prefetching does nothing: there is no
 * server to fetch from.
 *
 * @module
 */
import {
  type AnchorHTMLAttributes,
  Children,
  cloneElement,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref
} from "react";

import { appSettings } from "../appSettings.ts";
import { type Href, hrefText, routeAfter } from "../route.ts";
import { currentStore } from "../routeStore.ts";

/** The props of `Link`: Next.js's, and the anchor's own. */
export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  /** Where it goes: a path, or a URL object (`{ pathname: "/blog/[slug]", query: { slug: "hello" } }`). */
  readonly href: Href;
  /** The path the browser shows, when the Pages Router's `href` names a route. */
  readonly as?: Href;
  /** Whether it replaces the current entry of the history instead of adding one. */
  readonly replace?: boolean;
  /** Whether the page scrolls to the top: no effect in a story. */
  readonly scroll?: boolean;
  /** The Pages Router's shallow routing: no effect in a story. */
  readonly shallow?: boolean;
  /** With `legacyBehavior`, whether the child gets the href. */
  readonly passHref?: boolean;
  /** Whether the route is prefetched: no effect in a story. */
  readonly prefetch?: boolean | "auto" | null;
  /** The Pages Router's locale: no effect in a story. */
  readonly locale?: string | false;
  /** Whether the child is the anchor, as before Next.js 13. */
  readonly legacyBehavior?: boolean;
  /** Called before the route moves; calling its `preventDefault` stops it. */
  readonly onNavigate?: (event: { readonly preventDefault: () => void }) => void;
  /** The anchor's content, or the anchor itself with `legacyBehavior`. */
  readonly children?: ReactNode;
  /** The anchor. */
  readonly ref?: Ref<HTMLAnchorElement>;
};

/**
 * The href the anchor shows: the base path before a path of the app.
 *
 * @param href - where it goes.
 */
const shownHref = (href: Href): string => {
  const { text } = hrefText(href);
  return text.startsWith("/") && !text.startsWith("//") ? `${appSettings().basePath}${text}` : text;
};

/**
 * Whether a click is the browser's to handle: a modifier key, another button, another target or a download.
 *
 * @param event - the click.
 */
const isBrowsersClick = (event: MouseEvent<HTMLAnchorElement>): boolean => {
  const anchor = event.currentTarget;
  const target = anchor.getAttribute("target");
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (target !== null && target !== "" && target !== "_self") ||
    anchor.hasAttribute("download")
  );
};

/**
 * The click handler of a link: the given one first, then the route moves unless the click is the browser's.
 *
 * @param props - the link's props.
 * @param own - the handler the anchor (or the legacy child) was given.
 */
const clickHandler =
  (props: LinkProps, own: ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined) =>
  (event: MouseEvent<HTMLAnchorElement>): void => {
    own?.(event);
    if (isBrowsersClick(event)) return;
    const store = currentStore();
    const href = props.as ?? props.href;
    // an href outside the app (another origin) is the browser's to follow, as Next.js leaves it
    if (routeAfter(store.route(), href) === undefined) return;
    event.preventDefault();
    let isPrevented = false;
    props.onNavigate?.({
      preventDefault: (): void => {
        isPrevented = true;
      }
    });
    if (!isPrevented) store.navigate(props.replace === true ? "replace" : "push", href);
  };

/** Whether a value is an anchor's click handler. */
const isClickHandler = (value: unknown): value is (event: MouseEvent<HTMLAnchorElement>) => void =>
  typeof value === "function";

/**
 * Next.js's `Link`.
 *
 * @param props - its props.
 */
const Link = (props: LinkProps): ReactNode => {
  const {
    href,
    as,
    replace: _replace,
    scroll: _scroll,
    shallow: _shallow,
    passHref,
    prefetch: _prefetch,
    locale: _locale,
    legacyBehavior,
    onNavigate: _onNavigate,
    children,
    onClick,
    ref,
    ...anchor
  } = props;
  const shown = shownHref(as ?? href);
  if (legacyBehavior !== true)
    return (
      <a {...anchor} ref={ref} href={shown} onClick={clickHandler(props, onClick)}>
        {children}
      </a>
    );
  // the child is the anchor: a text is wrapped in one, as Next.js does, and gets its href below
  // biome-ignore lint/a11y/useValidAnchor: the anchor's href is given by the clone below, as Next.js's Link gives it
  const child: ReactNode = typeof children === "string" ? <a>{children}</a> : Children.only(children);
  if (!isValidElement<Readonly<Record<string, unknown>>>(child)) return child;
  const own = child.props["onClick"];
  const element: ReactElement = cloneElement(child, {
    ...(passHref === true || child.type === "a" ? { href: shown } : {}),
    onClick: clickHandler(props, isClickHandler(own) ? own : undefined)
  });
  return element;
};

export default Link;

/** Whether the link's navigation is pending: never, since a story's route moves at once. */
export const useLinkStatus = (): { readonly pending: boolean } => ({ pending: false });
