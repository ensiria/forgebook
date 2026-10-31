/**
 * The panel's Parts and styling tab: the keys of `classNames`, `styles` and `refs`, the `data-*` hooks of the
 * modifiers, and the test ids of the parts.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { ComponentDocs } from "../componentDocs.ts";
import { Code } from "./Code.tsx";
import { STRINGS } from "./strings.ts";

/** The props that carry a component's modifiers, each mirrored by a `data-*` styling hook. */
const MODIFIERS = ["variant", "size", "tone", "shape", "width", "orientation"];

/**
 * The `data-*` hooks of a component's modifiers.
 *
 * @param docs - the component's docs.
 */
export const styleHooks = (docs: ComponentDocs): string[] =>
  docs.props
    .filter((prop) => prop.kind === "choice" && MODIFIERS.includes(prop.name))
    .map((prop) => `data-${prop.name}="${(prop.choices ?? []).join(" | ")}"`);

/**
 * The Parts and styling tab.
 *
 * @param props - the component's docs.
 */
export const PartsTab = ({ docs }: { readonly docs: ComponentDocs }): ReactNode => {
  const hooks = styleHooks(docs);
  return (
    <div className="forgebook-tab-columns">
      {docs.parts.length === 0 ? null : (
        <div className="forgebook-prop-group">
          <h3 className="forgebook-prop-group__title">{STRINGS.partsList}</h3>
          <p className="forgebook-prop__description">
            <code>classNames</code>, <code>styles</code>, <code>refs</code>: {docs.parts.join(", ")}
          </p>
          <h3 className="forgebook-prop-group__title">{STRINGS.testIds}</h3>
          <p className="forgebook-prop__description">
            {docs.parts.map((part) => `<testId>__${part}`).join(", ")}
          </p>
        </div>
      )}
      {hooks.length === 0 ? null : (
        <div className="forgebook-prop-group">
          <h3 className="forgebook-prop-group__title">{STRINGS.styleHooks}</h3>
          {hooks.map((hook) => (
            <Code key={hook} text={hook} names={[]} />
          ))}
        </div>
      )}
    </div>
  );
};
