/**
 * A component whose props take more than a text or a number: what the panel's nested fields, mixed unions, tokens and
 * named values are tried on. It writes what it receives, so a test can read it.
 *
 * @module
 */
import type { ReactNode } from "react";

/** An icon, which no link can hold: the source names the ones a reader may pick. */
export type ValueIcon = () => ReactNode;

/** The countries a long choice offers. */
export type ValueCountry =
  | "Austria"
  | "Belgium"
  | "Croatia"
  | "Denmark"
  | "Estonia"
  | "Finland"
  | "France"
  | "Germany"
  | "Greece"
  | "Hungary"
  | "Ireland"
  | "Italy"
  | "Japan"
  | "Latvia"
  | "Malta";

/** The component's props. */
export type ValuePropsProps = {
  /** The labels it shows, in order. */
  readonly tags?: readonly string[];
  /** Where it ships. */
  readonly address?: {
    /** The street, which must be given. */
    readonly street: string;
    /** The city, when it is known. */
    readonly city?: string;
    /** The floor, when it is known. */
    readonly floor?: number;
  };
  /** Its rows, each with an id and a label. */
  readonly rows?: readonly {
    readonly id: number;
    readonly label: string;
    readonly isDone?: boolean;
  }[];
  /** A size by name, or in px. */
  readonly size?: "sm" | "md" | number;
  /** The lowest and the highest value. */
  readonly bounds?: readonly [number, number];
  /** A number under each name. */
  readonly scores?: Readonly<Record<string, number>>;
  /** Whatever it is given. */
  readonly payload?: unknown;
  /** A single line. */
  readonly title?: string;
  /** How many. */
  readonly count?: number;
  /** Several lines. */
  readonly note?: string;
  /**
   * Its accent colour.
   *
   * @token color
   */
  readonly accent?: string;
  /** Where it ships from. */
  readonly country?: ValueCountry;
  /** The icon beside its title. */
  readonly icon?: ValueIcon;
  /** What it holds, as a text or a named node. */
  readonly slot?: ReactNode;
  /** Called with each row, which only a function can do. */
  readonly renderRow?: (row: string) => ReactNode;
};

/**
 * Writes the props it receives.
 *
 * @param props - the props.
 */
export const ValueProps = ({ icon, slot, renderRow: _renderRow, ...rest }: ValuePropsProps): ReactNode => (
  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
    <output data-testid="value-props">{JSON.stringify(rest)}</output>
    <div data-testid="value-icon">{icon === undefined ? "no icon" : icon()}</div>
    <div data-testid="value-slot">{slot ?? "no slot"}</div>
  </div>
);
