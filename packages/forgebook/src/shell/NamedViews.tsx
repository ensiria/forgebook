/**
 * The named views at the top of the View menu: the catalogue's, then the reader's, each picked with a press (the one
 * the view matches marked), the reader's removed with their own button, and the values of the moment saved under a
 * name.
 *
 * @module
 */
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useMemo,
  useState
} from "react";

import {
  isSameView,
  type NamedView,
  namedViewsText,
  readNamedViews,
  viewValues,
  withoutView,
  withSavedView,
  withViewValues
} from "../namedViews.ts";
import { parseView, type ViewState } from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { Icon } from "./icons.tsx";
import { STRINGS } from "./strings.ts";
import { useStored } from "./useStored.ts";

/**
 * The named views.
 *
 * @param props - the view shown, the person's own, and the setter.
 */
export const NamedViews = ({
  view,
  ownView,
  onViewChange
}: {
  /** The view shown, the story's fixed values in it. */
  readonly view: ViewState;
  /** The person's own view: what a saved view holds. */
  readonly ownView: ViewState;
  /** Called with the changed view. */
  readonly onViewChange: (view: ViewState) => void;
}): ReactNode => {
  const catalogue = useCatalogue();
  const [saved, setSaved] = useStored("views", readNamedViews, namedViewsText);
  const [isNaming, setIsNaming] = useState(false);
  const [name, setName] = useState("");
  const declared = useMemo(
    (): NamedView[] =>
      catalogue.views.map((each) => ({
        name: each.name,
        values: viewValues(parseView(each.query, catalogue))
      })),
    [catalogue]
  );
  const own = viewValues(ownView);
  const save = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSaved((current) => withSavedView(current, { name, values: own }));
    setName("");
    setIsNaming(false);
  };
  const cancel = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Escape") return;
    // the field's Escape: the menu stays open
    event.stopPropagation();
    setIsNaming(false);
  };
  const chip = (each: NamedView, isOwn: boolean): ReactNode => (
    <span key={`${isOwn ? "own" : "catalogue"}:${each.name}`} className="forgebook-named-view">
      <button
        type="button"
        className="forgebook-named-view__pick"
        aria-pressed={isSameView(each.values, own, catalogue.switches)}
        onClick={(): void => onViewChange(withViewValues(view, each.values))}
      >
        {each.name}
      </button>
      {isOwn ? (
        <button
          type="button"
          className="forgebook-named-view__remove"
          aria-label={STRINGS.removeView(each.name)}
          title={STRINGS.removeView(each.name)}
          onClick={(): void => setSaved((current) => withoutView(current, each.name))}
        >
          <Icon name="close" size={10} />
        </button>
      ) : null}
    </span>
  );
  return (
    <section className="forgebook-named-views" aria-label={STRINGS.namedViews}>
      {declared.map((each) => chip(each, false))}
      {saved.map((each) => chip(each, true))}
      {isNaming ? (
        <form className="forgebook-named-views__form" onSubmit={save}>
          <input
            type="text"
            aria-label={STRINGS.viewName}
            placeholder={STRINGS.viewName}
            value={name}
            // biome-ignore lint/a11y/noAutofocus: the field opens on the person's press, to be typed in at once
            autoFocus={true}
            onKeyDown={cancel}
            onChange={(event: ChangeEvent<HTMLInputElement>): void => setName(event.target.value)}
          />
        </form>
      ) : (
        <button type="button" className="forgebook-text-button" onClick={(): void => setIsNaming(true)}>
          {STRINGS.saveView}
        </button>
      )}
    </section>
  );
};
