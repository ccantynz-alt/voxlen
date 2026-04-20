import React from "react";
import { AlertTriangle, RefreshCw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

function reportBoundaryError(error: Error, info: React.ErrorInfo): void {
  // In dev we surface through the browser's error reporter so stack traces and
  // source maps work. In prod this is a no-op until a real telemetry hook lands.
  const reporter = (globalThis as unknown as { console?: Console }).console;
  reporter?.error?.("ErrorBoundary caught an error:", error, info);
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional label shown in the fallback UI (e.g. "Dictation"). */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  info: React.ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, info: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.setState({ error, info });
    reportBoundaryError(error, info);
  }

  handleReload = (): void => {
    // Try to reset the boundary first; if the underlying issue persists,
    // users can fall back to a full page reload.
    this.setState({ hasError: false, error: null, info: null, copied: false });
  };

  handleFullReload = (): void => {
    window.location.reload();
  };

  handleCopy = async (): Promise<void> => {
    const { error, info } = this.state;
    const payload = [
      `Error: ${error?.name ?? "Unknown"}`,
      `Message: ${error?.message ?? "(no message)"}`,
      "",
      "Stack:",
      error?.stack ?? "(no stack)",
      "",
      "Component stack:",
      info?.componentStack ?? "(no component stack)",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(payload);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // Ignore
    }
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    const { error, copied } = this.state;
    const label = this.props.label ?? "this view";

    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
          <AlertTriangle className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-surface-950 mb-1">
          Something went wrong
        </h2>
        <p className="text-sm text-surface-600 max-w-md mb-4">
          An unexpected error occurred in {label}. You can try again or copy the error details below.
        </p>
        {error?.message && (
          <pre className="max-w-md w-full px-3 py-2 mb-4 rounded-lg bg-surface-100 border border-surface-300/50 text-xs text-surface-800 whitespace-pre-wrap break-words text-left">
            {error.message}
          </pre>
        )}
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={this.handleReload}>
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
          <Button variant="ghost" size="sm" onClick={this.handleFullReload}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reload app
          </Button>
          <Button variant="ghost" size="sm" onClick={this.handleCopy}>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy error"}
          </Button>
        </div>
      </div>
    );
  }
}
