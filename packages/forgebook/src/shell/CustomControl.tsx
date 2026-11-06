/**
 * The element a custom control draws in, and what stands between it and the panel: its value checked both ways, and its
 * failures kept beside the field. Loaded with the first story that names such a control.
 *
 * @remarks
 * The control keeps what it draws: mounting it again on each of its own changes would take the focus out of it. So it is
 * mounted again only when the value differs from the one it last gave, which is a change from outside (Reset, a link). An error it throws later, in its own event handler, is out of reach here: the page's own, as a plugin's.
 *
 * @module
 */
import { type ReactNode, useEffect, useRef, useState } from "react";

import type { ArgControlModule, ControlArgType } from "../argControl.ts";
import type { PanelProp } from "../argTypes.ts";
import { type ArgValue, isArgValue, UNSET_ARG } from "../messages.ts";
import {
  type ArgControlLoaders,
  CONTROL_STRINGS,
  controlValueProblem,
  loadControl
} from "./customControls.ts";
import type { OnValueChange } from "./PropFields.tsx";

/** The host's props. */
export type CustomControlProps = {
  /** The prop. */
  readonly prop: PanelProp;
  /** The name of the control it asks for. */
  readonly name: string;
  /** Its value. */
  readonly value: ArgValue | undefined;
  /** The catalogue's custom controls. */
  readonly loaders: ArgControlLoaders;
  /** Called with a changed value. */
  readonly onValueChange: OnValueChange;
};

/** What a control is told of its arg. */
const argTypeOf = (prop: PanelProp): ControlArgType => ({
  name: prop.name,
  label: prop.label ?? prop.name,
  description: prop.description,
  ...(prop.choices === undefined ? {} : { options: prop.choices }),
  ...(prop.min === undefined ? {} : { min: prop.min }),
  ...(prop.max === undefined ? {} : { max: prop.max }),
  ...(prop.step === undefined ? {} : { step: prop.step }),
  ...(prop.settings === undefined ? {} : { settings: prop.settings })
});

/** The value as text, to tell whether it is still the one the control gave. */
const textOf = (value: ArgValue | undefined): string => JSON.stringify(value) ?? "";

/** What a control's room needs. */
type ControlRoomProps = {
  /** The control's module. */
  readonly module: ArgControlModule;
  /** Its name, for what is said of it. */
  readonly name: string;
  /** The value it is mounted with. */
  readonly value: ArgValue | undefined;
  /** What the story says of the arg. */
  readonly argType: ControlArgType;
  /** Takes a value it gave, once it passed. */
  readonly onAccepted: (value: ArgValue | undefined) => void;
  /** Says what went wrong; none takes it back. */
  readonly onProblem: (problem: string | undefined) => void;
};

/** A value a control gave, checked: what to send, or what is wrong with it. */
const checkedChange = (
  module: ArgControlModule,
  next: unknown
): { readonly value: ArgValue | undefined } | { readonly problem: string } => {
  if (next === undefined) return { value: undefined };
  if (!isArgValue(next)) return { problem: "not plain JSON" };
  const problem = controlValueProblem(module, next);
  return problem === undefined ? { value: next } : { problem };
};

/**
 * The element one mount of a control draws in. It is given a new key for each mount, so nothing it holds outlives one.
 *
 * @param props - the module, the value it starts from, and what it reports to.
 */
const ControlRoom = ({
  module,
  name,
  value,
  argType,
  onAccepted,
  onProblem
}: ControlRoomProps): ReactNode => {
  const element = useRef<HTMLDivElement>(null);
  const start = useRef({ value, argType, onAccepted, onProblem });
  start.current = { value, argType, onAccepted, onProblem };
  useEffect(() => {
    const host = element.current;
    if (host === null) return;
    const { value: shown, argType: told, onProblem: say } = start.current;
    const refusal = shown === undefined ? undefined : controlValueProblem(module, shown);
    say(refusal === undefined ? undefined : CONTROL_STRINGS.controlValue(name, refusal));
    let isMounted = true;
    let unmount: unknown;
    try {
      unmount = module.mount(host, {
        // what does not fit never reaches a control that wrote its schema so as not to expect it
        value: refusal === undefined ? shown : undefined,
        onChange: (next: unknown): void => {
          if (!isMounted) return;
          const change = checkedChange(module, next);
          if ("problem" in change)
            start.current.onProblem(CONTROL_STRINGS.controlValue(name, change.problem));
          else {
            start.current.onProblem(undefined);
            start.current.onAccepted(change.value);
          }
        },
        argType: told
      });
    } catch (error) {
      say(CONTROL_STRINGS.controlThrew(name, error instanceof Error ? error.message : String(error)));
    }
    return (): void => {
      isMounted = false;
      // after this commit: a control written in React cannot take its own root away while the shell's is rendering
      queueMicrotask(() => {
        try {
          if (typeof unmount === "function") unmount();
        } catch {
          // it is leaving: there is no field left to say so beside, and the next mount says what is still wrong
        }
      });
    };
  }, [module, name]);
  return <div ref={element} className="forgebook-custom-control" data-control={name} />;
};

/** A loaded control, and what it last said. */
const MountedControl = ({
  module,
  prop,
  name,
  value,
  onValueChange
}: Omit<CustomControlProps, "loaders"> & { readonly module: ArgControlModule }): ReactNode => {
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const given = useRef(textOf(value));
  // counts the changes from outside: each is a new mount, which reads the value of its moment
  const [mounts, setMounts] = useState(0);
  if (textOf(value) !== given.current) {
    given.current = textOf(value);
    setMounts(mounts + 1);
  }
  const argType = argTypeOf(prop);
  return (
    <>
      <ControlRoom
        key={`${mounts}|${JSON.stringify(argType)}`}
        module={module}
        name={name}
        value={value}
        argType={argType}
        onProblem={setProblem}
        onAccepted={(next: ArgValue | undefined): void => {
          given.current = textOf(next);
          onValueChange(prop.name, next ?? UNSET_ARG);
        }}
      />
      {problem === undefined ? null : (
        <p className="forgebook-prop__description forgebook-prop__problem" role="alert">
          {problem}
        </p>
      )}
    </>
  );
};

/**
 * A custom control, or why there is none.
 *
 * @param props - the prop, the control's name, its value, and the catalogue's controls.
 */
export const CustomControl = ({ loaders, ...props }: CustomControlProps): ReactNode => {
  const [loaded, setLoaded] = useState<Awaited<ReturnType<typeof loadControl>> | undefined>(undefined);
  useEffect(() => {
    let isCurrent = true;
    void loadControl(props.name, loaders).then((control) => {
      if (isCurrent) setLoaded(control);
    });
    return (): void => {
      isCurrent = false;
    };
  }, [props.name, loaders]);
  if (loaded === undefined) return null;
  if (loaded.status === "failed") {
    return (
      <p className="forgebook-prop__description forgebook-prop__problem" role="alert">
        {loaded.message}
      </p>
    );
  }
  return <MountedControl {...props} module={loaded.module} />;
};
