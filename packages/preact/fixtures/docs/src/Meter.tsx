/**
 * A level between nothing and full, drawn by a class component.
 *
 * @module
 */
import { Component, type VNode } from "preact";

/** The meter's props. */
export type MeterProps = {
  /** How full it is, from 0 to 1. */
  readonly value: number;
  /** Its name for screen readers. */
  readonly label?: string;
};

/** A level between nothing and full. */
export class Meter extends Component<MeterProps> {
  /** The meter. */
  override render(): VNode {
    return <meter aria-label={this.props.label} value={this.props.value} />;
  }
}
