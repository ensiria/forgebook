/**
 * The boundary around a story: an error thrown while the story renders is shown in the frame, with its stack, and
 * reported, instead of leaving an empty frame that never says it is ready.
 *
 * @remarks
 * React catches render errors only in a class component (`getDerivedStateFromError`), so this is the frame's one
 * class. A new `resetKey` (the story's args, changed by the props panel or Replay) clears the error and renders the
 * story again, so a value that made it throw can be changed back.
 *
 * @module
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

/** The boundary's props. */
export type StoryErrorBoundaryProps = {
  /** The story. */
  readonly children: ReactNode;
  /** Renders the story again after an error when it changes. */
  readonly resetKey: unknown;
  /** Called once with the error's message when the story fails to render. */
  readonly onError: (message: string) => void;
};

/** The error caught, if any. */
type StoryErrorBoundaryState = { readonly error: Error | undefined };

/** Shows a story's render error in place of the story. */
export class StoryErrorBoundary extends Component<StoryErrorBoundaryProps, StoryErrorBoundaryState> {
  override state: StoryErrorBoundaryState = { error: undefined };

  /**
   * Keeps the error, so the next render shows it.
   *
   * @param error - what the story threw.
   */
  static getDerivedStateFromError(error: unknown): StoryErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  /**
   * Reports the error once it is shown.
   *
   * @param error - what the story threw.
   * @param _info - React's component stack, already in the console.
   */
  override componentDidCatch(error: unknown, _info: ErrorInfo): void {
    this.props.onError(error instanceof Error ? error.message : String(error));
  }

  /**
   * Clears a caught error when the reset key changes.
   *
   * @param previous - the props of the last render.
   */
  override componentDidUpdate(previous: StoryErrorBoundaryProps): void {
    if (this.state.error !== undefined && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: undefined });
    }
  }

  /** The story, or its error. */
  override render(): ReactNode {
    const { error } = this.state;
    if (error === undefined) return this.props.children;
    return (
      <div className="forgebook-frame-error" role="alert">
        <p className="forgebook-frame-error__message">{error.message}</p>
        {error.stack === undefined ? null : <pre className="forgebook-frame-error__stack">{error.stack}</pre>}
      </div>
    );
  }
}
