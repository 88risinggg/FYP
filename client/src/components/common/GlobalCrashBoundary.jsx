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
      <div className="app-page flex min-h-screen items-center justify-center px-6 py-10">
        <div className="app-panel w-full max-w-3xl rounded-2xl p-8 text-[#251E1F]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#F38978]">Client Recovery Helper</p>
          <h1 className="mt-2 text-2xl font-semibold">The page crashed, but diagnostics are available.</h1>
          <p className="mt-3 text-sm text-[#7b6660]">
            Source: <span className="font-semibold text-[#251E1F]">{this.state.source || "unknown"}</span>
          </p>
          <p className="mt-1 text-sm text-[#7b6660]">
            Route: <span className="font-semibold break-all text-[#251E1F]">{window.location.pathname}</span>
          </p>

          <div className="mt-6 rounded-xl border border-[#f0d2ca] bg-white/800 p-4 text-sm text-[#251E1F]">
            {errorMessage}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-[#F38978] px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#F38978]"
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
              className="rounded-lg border border-[#ead3cc] bg-white/800 px-4 py-2 text-sm font-semibold text-[#251E1F] hover:bg-[#FDD9CD]/45"
            >
              Reset Session
            </button>
          </div>
        </div>
      </div>
    );
  }
}
