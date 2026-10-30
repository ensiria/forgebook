/**
 * The colour scheme and contrast switches at the toolbar's start, off while the compare view sets them or the story
 * fixes them.
 *
 * @module
 */
import type { ReactNode } from "react";

import type { FixedView } from "../storyGlobals.ts";
import { switchWithRole, type ViewSwitch } from "../switches.ts";
import type { ViewState } from "../viewState.ts";
import { useCatalogue } from "./catalogueContext.ts";
import { Icon, type IconName } from "./icons.tsx";
import { Segmented } from "./Segmented.tsx";
import { STRINGS } from "./strings.ts";
import { switchValueIn, withSwitch } from "./switchView.ts";

/** The icon of each scheme a colour scheme switch's values draw in. */
const SCHEME_ICONS: Readonly<Record<"light" | "dark" | "system", IconName>> = {
  light: "sun",
  dark: "moon",
  system: "monitor"
};

/**
 * The colour scheme switch and the contrast switch, at the toolbar's start: the scheme as segments with icons, a
 * two-value contrast as a toggle (a longer one as segments).
 *
 * @param props - the view, its setter, and whether a story's page is shown (the compare view sets them there).
 */
export const SchemeSwitches = ({
  view,
  onViewChange,
  isStoryPage,
  fixed
}: {
  /** The view shown. */
  readonly view: ViewState;
  /** Called with the changed view. */
  readonly onViewChange: (view: ViewState) => void;
  readonly isStoryPage: boolean;
  readonly fixed: FixedView;
}): ReactNode => {
  const switches = useCatalogue().switches;
  const scheme = switchWithRole(switches, "colorScheme");
  const contrast = switchWithRole(switches, "contrast");
  const isFixed = (each: ViewSwitch): boolean => fixed.switches[each.id] !== undefined;
  const isCompared = (each: ViewSwitch): boolean =>
    (isStoryPage && view.compare.includes(each.id)) || isFixed(each);
  const more = contrast?.values.find((value) => value.isMore === true);
  const standard = contrast?.values.find((value) => value.isMore !== true);
  if (scheme === undefined && contrast === undefined) return null;
  return (
    <div className="forgebook-toolbar__group">
      {scheme === undefined ? null : (
        <Segmented
          label={scheme.label}
          isDisabled={isCompared(scheme)}
          disabledNote={isFixed(scheme) ? STRINGS.setByStory : undefined}
          options={scheme.values.map((value) => ({
            value: value.value,
            label: value.label,
            icon: SCHEME_ICONS[value.scheme ?? "light"]
          }))}
          value={switchValueIn(view, scheme)}
          onValueChange={(value: string): void => onViewChange(withSwitch(view, scheme, value))}
        />
      )}
      {contrast === undefined || more === undefined || standard === undefined ? null : (
        <button
          type="button"
          className="forgebook-button"
          title={isFixed(contrast) ? STRINGS.setByStory : contrast.label}
          aria-pressed={switchValueIn(view, contrast) === more.value}
          disabled={isCompared(contrast)}
          onClick={(): void =>
            onViewChange(
              withSwitch(
                view,
                contrast,
                switchValueIn(view, contrast) === more.value ? standard.value : more.value
              )
            )
          }
        >
          <Icon name="contrast" size={14} />
          <span className="forgebook-button__label">{contrast.label}</span>
        </button>
      )}
    </div>
  );
};
