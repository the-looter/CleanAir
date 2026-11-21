import React from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || "An unexpected rendering error occurred.",
    };
  }

  componentDidCatch(error: Error): void {
    console.error("ClearAir UI error boundary caught:", error);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, message: "" });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-white p-8"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
            <div>
              <h1 className="font-display text-lg font-semibold text-slate-900">
                Something went wrong rendering this view
              </h1>
              <p className="mt-1 text-sm text-slate-600">{this.state.message}</p>
              <button
                type="button"
                onClick={this.handleReset}
                className="mt-4 min-h-[40px] rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                Reload View
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
