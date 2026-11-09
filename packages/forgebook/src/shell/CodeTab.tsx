/**
 * The panel's Code tab: the story's `render` as written in its file, or, for a story drawn from its args, the
 * component's JSX with the args its file writes as code and the values of the moment (the story's and the Props
 * tab's), with a button that copies it. A value a custom control sets is written as the code its control's `toCode`
 * gives (`icon={IconStar}`), its module loaded as the panel loads it.
 *
 * @module
 */

import { type ReactNode, useEffect, useMemo, useState } from "react";

import { panelProps, settableProps } from "../argTypes.ts";
import { type ControlCoders, controlCodeOf } from "../controlCode.ts";
import { type StoryCodeSource, storyCodeText } from "../storyCodeText.ts";
import { useCodeWriter } from "./codeWriter.ts";
import type { DockTabsInput } from "./dockTabs.tsx";
import { LATER_STRINGS } from "./laterStrings.ts";
import { hasRenderCode, StoryCodeBlock } from "./StoryCodeBlock.tsx";
import { STRINGS } from "./strings.ts";
import { useCopy } from "./useCopy.ts";

/** The tab's props: the story whose code it shows, and what the panel knows of its props. */
export type CodeTabProps = StoryCodeSource & {
  /** The component's docs, the story's `argTypes` and the catalogue's custom controls; none writes every value as JSON. */
  readonly panel?: Pick<DockTabsInput, "docs" | "argTypes" | "storyArgs" | "controls" | "argControls">;
};

/**
 * The code the story's custom controls write its values as, once their modules are loaded.
 *
 * @param props - the story and what the panel knows of its props.
 */
const useArgCode = ({ panel, args }: CodeTabProps): Readonly<Record<string, string>> => {
  const props = useMemo(
    () =>
      panel === undefined || panel.docs.status !== "ready"
        ? []
        : settableProps(
            panelProps(panel.docs.value.props, panel.argTypes, panel.storyArgs),
            panel.controls,
            {}
          ),
    [panel]
  );
  const names = [...new Set(props.flatMap((prop) => prop.customControl ?? []))].join("\n");
  const [coders, setCoders] = useState<ControlCoders>({});
  const loaders = panel?.argControls;
  useEffect(() => {
    if (names === "" || loaders === undefined) return;
    let isCurrent = true;
    void import("./customControls.ts")
      .then(({ loadControl }) =>
        Promise.all(names.split("\n").map(async (name) => [name, await loadControl(name, loaders)] as const))
      )
      .then((loaded) => {
        if (!isCurrent) return;
        setCoders(
          Object.fromEntries(
            loaded.flatMap(([name, control]) =>
              control.status === "ready" ? [[name, control.module.toCode]] : []
            )
          )
        );
      });
    return (): void => {
      isCurrent = false;
    };
  }, [names, loaders]);
  return useMemo(() => controlCodeOf(props, args, coders), [props, args, coders]);
};

/**
 * The Code tab.
 *
 * @param props - the file's code, the story, the component's name and the args.
 */
export const CodeTab = (tab: CodeTabProps): ReactNode => {
  const { isCopied, copy } = useCopy();
  const write = useCodeWriter();
  const argCode = useArgCode(tab);
  const { panel: _panel, ...source } = tab;
  const props: StoryCodeSource = { ...source, argCode };
  const hasRender = hasRenderCode(props);
  return (
    <div className="forgebook-prop-group">
      <div className="forgebook-calls__head">
        <h3 className="forgebook-prop-group__title">
          {hasRender ? LATER_STRINGS.codeRender : LATER_STRINGS.codeFromArgs}
        </h3>
        <button
          type="button"
          className="forgebook-text-button"
          onClick={(): void => copy(storyCodeText(props, write))}
          aria-live="polite"
        >
          {isCopied ? STRINGS.copied : LATER_STRINGS.copy}
        </button>
      </div>
      <StoryCodeBlock {...props} />
    </div>
  );
};
