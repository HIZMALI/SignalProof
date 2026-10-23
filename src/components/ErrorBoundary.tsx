import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* Keep user announcement data out of logs. */
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <h1>The lab could not open.</h1>
          <p>Your saved draft has not been deleted. Reload to try again.</p>
          <button
            className="button button-primary"
            onClick={() => window.location.reload()}
          >
            Reload SignalProof
          </button>
        </main>
      );
    return this.props.children;
  }
}
