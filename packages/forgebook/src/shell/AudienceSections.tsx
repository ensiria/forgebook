/**
 * What goes around the frames of a component's page drawn for one audience, in the order `audiencePage.ts` gives it:
 * the note that says so, the page's own sections, and the audience's: when to use the component, the docs pages that
 * show it, its tokens and its parts.
 *
 * @remarks
 * One chunk split from the shell, loaded with the first page drawn for someone else: a catalogue read by everyone pays
 * for it nothing. The tokens come from the plugin's module, loaded by their section; the whole catalogue's stay closed
 * until asked for, since a library may have thousands.
 *
 * @module
 */
import "./audienceSections.scss";

import { Fragment, type MouseEvent, type ReactNode, type RefObject } from "react";

import type { AudienceId } from "../audiences.ts";
import type { ComponentDocs, UsageGuidance as Guidance } from "../componentDocs.ts";
import { pagesAbout } from "../pageTree.ts";
import type { StoryTree, TreeComponent, TreeStory } from "../storyTree.ts";
import {
  AUDIENCE_PAGES,
  AUDIENCE_TEXTS,
  isShellTokens,
  type PageSection,
  proseFor,
  type ShellToken,
  type ShellTokens,
  tokensAbout
} from "./audiencePage.ts";
import { CodeText } from "./CodeText.tsx";
import { Lead, PageApi } from "./ComponentPage.tsx";
import { styleHooks } from "./dockHints.ts";
import { PackageHtml } from "./PackageHtml.tsx";
import { PartsTab } from "./PartsTab.tsx";
import { StoryCoverage, type StoryCoverageProps } from "./StoryCoverage.tsx";
import { STRINGS } from "./strings.ts";
import { UsedIn, type UsedInProps } from "./UsedIn.tsx";
import { type Loaded, useLoaded } from "./useLoaded.ts";
import type { PageDoc } from "./usePageDoc.ts";

/** The place around the frames a part of the page goes in. */
export type AudiencePlace = "beforeDemo" | "afterDemo" | "afterExamples";

/** What the sections read. */
export type AudienceSectionsProps = {
  /** The place drawn. */
  readonly place: AudiencePlace;
  /** Who the page is drawn for. */
  readonly audience: Exclude<AudienceId, "everyone">;
  /** Whether the page says so: the catalogue may have fixed it, and then offers no way back. */
  readonly hasNote: boolean;
  /** Goes back to the whole page. */
  readonly onShowAll: () => void;
  /** The component. */
  readonly component: TreeComponent;
  /** Its docs; none until they load, or when it has none. */
  readonly docs: ComponentDocs | undefined;
  /** Whether it is about logic. */
  readonly isLogic: boolean;
  /** The documentation file. */
  readonly page: Loaded<PageDoc>;
  /** The tree. */
  readonly tree: StoryTree;
  /** The component's id. */
  readonly componentId: string;
  /** A docs page's address. */
  readonly pageHrefOf: (id: string) => string;
  /** Opens a docs page. */
  readonly onOpenPage: (id: string) => void;
  /** Loads the design tokens; none when the catalogue has none. */
  readonly loadTokens: (() => Promise<unknown>) | undefined;
  /** What the coverage table reads, and the view, whose change clears its checks. */
  readonly coverage: StoryCoverageProps & { readonly viewKey: string };
  /** What "Used in" reads; none when the catalogue turned it off. */
  readonly usedIn: Omit<UsedInProps, "title"> | undefined;
  /** The page's scrolling element. */
  readonly pageRef: RefObject<HTMLDivElement | null>;
};

/**
 * Says that the page is drawn for one audience, so a shared link never reads as a page with parts missing, and goes back
 * to all of it. The button goes with the note, so the focus moves to the page rather than being lost.
 *
 * @param props - the audience's name, how to show everything, and the page's scrolling element.
 */
const AudienceNote = ({
  name,
  onShowAll,
  pageRef
}: {
  readonly name: string;
  readonly onShowAll: () => void;
  readonly pageRef: RefObject<HTMLDivElement | null>;
}): ReactNode => (
  <p className="forgebook-audience-note">
    {AUDIENCE_TEXTS.audienceNote(name)}{" "}
    <button
      type="button"
      className="forgebook-text-button"
      onClick={(): void => {
        onShowAll();
        const page = pageRef.current;
        if (page === null) return;
        page.tabIndex = -1;
        page.focus({ preventScroll: true });
        page.addEventListener("blur", () => page.removeAttribute("tabindex"), { once: true });
      }}
    >
      {AUDIENCE_TEXTS.audienceShowAll}
    </button>
  </p>
);

/**
 * The parts and the styling hooks, the panel's own tab; nothing without either.
 *
 * @param props - the docs.
 */
const PartsSection = ({ docs }: { readonly docs: ComponentDocs | undefined }): ReactNode =>
  docs === undefined || (docs.parts.length === 0 && styleHooks(docs).length === 0) ? null : (
    <section className="forgebook-doc__section" aria-labelledby="forgebook-parts">
      <h2 id="forgebook-parts">{AUDIENCE_TEXTS.partsTitle}</h2>
      <PartsTab docs={docs} />
    </section>
  );

/** The most of the whole catalogue's tokens drawn at once: more would only slow the page. */
const TOKENS_SHOWN = 100;

/**
 * A list of what the guidance says, under its heading; nothing when it says nothing.
 *
 * @param props - the heading and the items.
 */
const GuidanceList = ({
  title,
  items
}: {
  readonly title: string;
  readonly items: readonly string[] | undefined;
}): ReactNode =>
  items === undefined || items.length === 0 ? null : (
    <div className="forgebook-guidance__list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <CodeText text={item} />
          </li>
        ))}
      </ul>
    </div>
  );

/**
 * When to use the component and when not, from its TSDoc.
 *
 * @param props - the guidance.
 */
export const UsageGuidance = ({ guidance }: { readonly guidance: Guidance }): ReactNode => (
  <section className="forgebook-doc__section" aria-labelledby="forgebook-guidance">
    <h2 id="forgebook-guidance">{AUDIENCE_TEXTS.guidance}</h2>
    {guidance.deprecated === undefined ? null : (
      <p className="forgebook-guidance__deprecated">
        <strong>{AUDIENCE_TEXTS.guidanceDeprecated}.</strong> <CodeText text={guidance.deprecated} />
        {guidance.replacedBy === undefined ? null : (
          <>
            {" "}
            {AUDIENCE_TEXTS.guidanceReplacedBy}: <CodeText text={guidance.replacedBy} />
          </>
        )}
      </p>
    )}
    <div className="forgebook-guidance">
      <GuidanceList title={AUDIENCE_TEXTS.guidanceUse} items={guidance.useWhen} />
      <GuidanceList title={AUDIENCE_TEXTS.guidanceAvoid} items={guidance.avoidWhen} />
      <GuidanceList title={AUDIENCE_TEXTS.guidanceAlternatives} items={guidance.alternatives} />
    </div>
  </section>
);

/** What the docs pages' section reads. */
export type AboutPagesProps = {
  /** The tree. */
  readonly tree: StoryTree;
  /** The component's id. */
  readonly id: string;
  /** Its stories. */
  readonly stories: readonly TreeStory[];
  /** A docs page's address. */
  readonly hrefOf: (id: string) => string;
  /** Opens a docs page. */
  readonly onOpen: (id: string) => void;
};

/**
 * The docs pages that show the component.
 *
 * @param props - the tree, the component's id and stories, the pages' addresses and how one opens.
 */
export const AboutPages = ({ tree, id, stories, hrefOf, onOpen }: AboutPagesProps): ReactNode => {
  const pages = pagesAbout(
    tree,
    id,
    stories.map((story) => story.id)
  );
  return pages.length === 0 ? null : (
    <section className="forgebook-doc__section" aria-labelledby="forgebook-about-pages">
      <h2 id="forgebook-about-pages">{AUDIENCE_TEXTS.aboutPages}</h2>
      <ul className="forgebook-about-pages">
        {pages.map((page) => (
          <li key={page.id}>
            <a
              className="forgebook-link"
              href={hrefOf(page.id)}
              onClick={(event: MouseEvent<HTMLAnchorElement>): void => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
                event.preventDefault();
                onOpen(page.id);
              }}
            >
              {page.name}
            </a>
            {page.description === undefined ? null : (
              <span className="forgebook-about-pages__description">{page.description}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

/** What the tokens' module answered, as a state. */
const tokensState = (value: unknown): Loaded<ShellTokens> =>
  isShellTokens(value)
    ? { status: "ready", value }
    : { status: "error", message: "The tokens have an unexpected shape" };

/**
 * A table of tokens: each one's name and value, in every theme where it differs, a colour with its swatch.
 *
 * @param props - the tokens.
 */
const TokenTable = ({ tokens }: { readonly tokens: readonly ShellToken[] }): ReactNode => (
  <div className="forgebook-api">
    <table className="forgebook-api__table">
      <thead>
        <tr>
          <th scope="col">{AUDIENCE_TEXTS.tokenName}</th>
          <th scope="col">{AUDIENCE_TEXTS.tokenValue}</th>
        </tr>
      </thead>
      <tbody>
        {tokens.map((token) => (
          <tr key={token.name}>
            <th scope="row" className="forgebook-api__name">
              {token.name}
            </th>
            <td>
              {[["", token.value] as const, ...Object.entries(token.modes)].map(([mode, value]) => (
                <span key={mode} className="forgebook-token">
                  {token.type === "color" ? (
                    <span className="forgebook-token__swatch" style={{ background: value }} />
                  ) : null}
                  {mode === "" ? value : `${mode}: ${value}`}
                </span>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/** What the tokens' section reads. */
export type TokensSectionProps = {
  /** Loads the tokens. */
  readonly load: () => Promise<unknown>;
  /** The component's name. */
  readonly componentName: string;
};

/**
 * The component's design tokens, then the whole catalogue's, closed.
 *
 * @param props - the tokens' loader and the component's name.
 */
export const TokensSection = ({ load, componentName }: TokensSectionProps): ReactNode => {
  const loaded = useLoaded(load, tokensState);
  if (loaded.status === "error") {
    return (
      <p className="forgebook-problems" role="alert">
        {AUDIENCE_TEXTS.tokensError}: {loaded.message}
      </p>
    );
  }
  if (loaded.status !== "ready") return null;
  const { tokens, problems } = loaded.value;
  const own = tokensAbout(tokens, componentName);
  const others = tokens.filter((token) => !own.includes(token));
  if (tokens.length === 0 && problems.length === 0) return null;
  return (
    <section className="forgebook-doc__section" aria-labelledby="forgebook-tokens">
      <h2 id="forgebook-tokens">{AUDIENCE_TEXTS.tokens}</h2>
      {problems.length === 0 ? null : (
        <p className="forgebook-problems" role="alert">
          {AUDIENCE_TEXTS.tokensError}: {problems.join("; ")}
        </p>
      )}
      {own.length === 0 ? null : <TokenTable tokens={own} />}
      {others.length === 0 ? null : (
        <details className="forgebook-tokens__others">
          <summary>{AUDIENCE_TEXTS.tokensOther(others.length)}</summary>
          <TokenTable tokens={others.slice(0, TOKENS_SHOWN)} />
          {others.length > TOKENS_SHOWN ? (
            <p>
              <CodeText text={AUDIENCE_TEXTS.tokensMore(others.length - TOKENS_SHOWN)} />
            </p>
          ) : null}
        </details>
      )}
    </section>
  );
};

/**
 * The documentation file as an audience reads it, or why it could not be read.
 *
 * @param props - the file and how much of it the audience sees.
 */
const AudienceProse = ({
  page,
  reading
}: {
  readonly page: Loaded<PageDoc>;
  readonly reading: Parameters<typeof proseFor>[1];
}): ReactNode => {
  if (page.status === "error") {
    return (
      <p className="forgebook-problems" role="alert">
        {STRINGS.pageError}: {page.message}
      </p>
    );
  }
  if (page.status !== "ready") return null;
  const html = proseFor(page.value.html, reading);
  return html === "" ? null : <PackageHtml className="forgebook-prose" html={html} />;
};

/**
 * One section.
 *
 * @param props - its name and what the sections read.
 */
const Section = ({ id, ...props }: AudienceSectionsProps & { readonly id: PageSection }): ReactNode => {
  const { component, docs, isLogic, page, loadTokens, coverage, usedIn } = props;
  const { viewKey, ...table } = coverage;
  switch (id) {
    case "lead":
      return <Lead page={page} docs={docs} />;
    case "guidance":
      return docs?.guidance === undefined ? null : <UsageGuidance guidance={docs.guidance} />;
    case "prose":
      return <AudienceProse page={page} reading={AUDIENCE_PAGES[props.audience].prose} />;
    case "api":
      return <PageApi docs={docs} isLogic={isLogic} />;
    case "parts":
      return <PartsSection docs={docs} />;
    case "pages":
      return (
        <AboutPages
          tree={props.tree}
          id={props.componentId}
          stories={component.stories}
          hrefOf={props.pageHrefOf}
          onOpen={props.onOpenPage}
        />
      );
    case "tokens":
      return loadTokens === undefined ? null : (
        <TokensSection load={loadTokens} componentName={docs?.name ?? component.name} />
      );
    case "coverage":
      return <StoryCoverage key={viewKey} {...table} />;
    default:
      return usedIn === undefined ? null : <UsedIn title={component.title} {...usedIn} />;
  }
};

/**
 * What goes in one place around the frames of a page drawn for an audience, the note first.
 *
 * @param props - the place, the audience and what the sections read.
 */
export const AudienceSections = (props: AudienceSectionsProps): ReactNode => (
  <>
    {props.place === "beforeDemo" && props.hasNote ? (
      <AudienceNote
        name={STRINGS.audiences[props.audience]}
        onShowAll={props.onShowAll}
        pageRef={props.pageRef}
      />
    ) : null}
    {AUDIENCE_PAGES[props.audience][props.place].map((id) => (
      <Fragment key={id}>
        <Section id={id} {...props} />
      </Fragment>
    ))}
  </>
);
