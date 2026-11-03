/**
 * The boundary around a story: an error thrown while the story renders, or in one of its effects, goes to the frame,
 * which shows it with its stack and reports it, instead of leaving an empty frame that never says it is ready.
 *
 * @remarks
 * Preact catches a render error in a class component (`componentDidCatch`), so this is the package's one class. While
 * the error stands it draws nothing: the frame draws the error, the same for every framework. A new `resetKey` (the
 * story's args, changed by the props panel or Replay) clears the error and renders the story again, so a value that
 * made it throw can be changed back. An error in an event handler is the handler's: the story stands, as in a page.
 *
 * @module
 */
import { Component, type ComponentChildren } from "preact";

/** The boundary's props. */
export type StoryErrorBoundaryProps = {
  /** The story. */
  readonly children: ComponentChildren;
  /** Renders the story again after an error when it changes. */
  readonly resetKey: unknown;
  /** Called once with the error when the story fails to render. */
  readonly onError: (error: Error) => void;
};

/** Whether the story threw. */
type StoryErrorBoundaryState = { readonly hasError: boolean };

/** The boundary. */
export class StoryErrorBoundary extends Component<StoryErrorBoundaryProps, StoryErrorBoundaryState> {
  /** No error at first. */
  override state: StoryErrorBoundaryState = { hasError: false };

  /** Whether the standing error was handed to the frame: the frame hears of each error once. */
  private isReported = false;

  /**
   * Hands the error to the frame, and draws nothing until the args change.
   *
   * @param error - what the story threw.
   */
  override componentDidCatch(error: unknown): void {
    this.setState({ hasError: true });
    if (this.isReported) return;
    this.isReported = true;
    this.props.onError(error instanceof Error ? error : new Error(String(error)));
  }

  /**
   * Clears the error when the story's args change.
   *
   * @param previous - the props before the change.
   */
  override componentDidUpdate(previous: StoryErrorBoundaryProps): void {
    if (this.state.hasError && previous.resetKey !== this.props.resetKey) {
      this.isReported = false;
      this.setState({ hasError: false });
    }
  }

  /** The story, or nothing while its error stands. */
  override render(): ComponentChildren {
    return this.state.hasError ? null : this.props.children;
  }
}
