/**
 * EVALUATION HEADER
 * FEATURE: SHARED / APPLICATION CORE
 * PURPOSE: Implements the application's main responsibilities.
 * LAYER: Frontend entry point - starts React and mounts the application.
 * FIND RELATED CODE: Use Find All References on its exports to locate connected features.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.jsx";
import GlobalCrashBoundary from "./components/common/GlobalCrashBoundary.jsx";
import { installSingaporeTimeDefaults } from "./utils/singaporeTime.js";
import "./styles/index.css";

installSingaporeTimeDefaults();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GlobalCrashBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </GlobalCrashBoundary>
  </React.StrictMode>
);

