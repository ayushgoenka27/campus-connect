import { Component } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

/**
 * Reusable Production Error Boundary (P7-06)
 * Catches JavaScript errors in child component trees, logs them, and renders
 * a user-friendly recovery UI without leaking internal stack traces or database info.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
      errorId: Date.now().toString(36).toUpperCase(),
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error internally for diagnostics without exposing to standard user UI
    if (import.meta.env?.DEV) {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center space-y-6">
            <div className="mx-auto w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
              <AlertTriangle size={28} />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Something went wrong
              </h1>
              <p className="text-sm text-slate-500 leading-relaxed">
                An unexpected interface error occurred. No data was lost. You can reload the page or return to your dashboard.
              </p>
              {this.state.errorId && (
                <p className="text-[11px] font-mono text-slate-400">
                  Reference ID: {this.state.errorId}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition shadow-sm"
              >
                <RotateCcw size={16} />
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition shadow-sm"
              >
                <Home size={16} />
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
