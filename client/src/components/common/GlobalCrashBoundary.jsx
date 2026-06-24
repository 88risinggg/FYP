import React from "react";

export default class GlobalCrashBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
      source: ""
    };
    this.handleWindowError = this.handleWindowError.bind(this);
    this.handleUnhandledRejection = this.handleUnhandledRejection.bind(this);
  }

  componentDidMount() {
    window.addEventListener("error", this.handleWindowError);
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentWillUnmount() {
    window.removeEventListener("error", this.handleWindowError);
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection);
  }

  componentDidCatch(error) {
    this.setState({
      error,
      source: "react"
    });
  }

  handleWindowError(event) {
    const error = event.error || new Error(event.message || "Unexpected runtime error");
    this.setState({
      error,
      source: "window"
    });
  }

  handleUnhandledRejection(event) {
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(String(reason || "Unhandled promise rejection"));
    this.setState({
      error,
      source: "promise"
    });
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    let errorMessage = this.state.error?.message || "Unknown client error";
    if (typeof errorMessage === "object") {
      try {
        errorMessage = JSON.stringify(errorMessage);
      } catch (_err) {
        errorMessage = "[object error message]";
      }
    }

    return (
      <div className="neon-page flex min-h-screen items-center justify-center px-6 py-10">
        <div className="neon-glass neon-border w-full max-w-3xl rounded-2xl p-8 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#C77DFF]">Client Recovery Helper</p>
          <h1 className="mt-2 text-2xl font-semibold">The page crashed, but diagnostics are available.</h1>
          <p className="mt-3 text-sm text-[#d8c6e8]">
            Source: <span className="font-semibold text-white">{this.state.source || "unknown"}</span>
          </p>
          <p className="mt-1 text-sm text-[#d8c6e8]">
            Route: <span className="font-semibold break-all text-white">{window.location.pathname}</span>
          </p>

          <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-[#f1e6ff]">
            {errorMessage}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-[#C77DFF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#b866ff]"
            >
              Reload Page
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem("authToken");
                localStorage.removeItem("authUser");
                window.location.href = "/login";
              }}
              className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Reset Session
            </button>
          </div>
        </div>
      </div>
    );
  }
}
