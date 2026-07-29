/**
 * Adds idempotent, evaluation-friendly documentation headers to production source files.
 * Run from the repository root with: node scripts/addEvaluationHeaders.cjs
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceRoots = [path.join(root, "client", "src"), path.join(root, "server", "src")];
const marker = "EVALUATION HEADER";

const excludedParts = [
  `${path.sep}assets${path.sep}`,
  `${path.sep}migrations${path.sep}`,
  `${path.sep}scripts${path.sep}`,
];

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(fullPath);
    if (!/\.(?:js|jsx)$/.test(entry.name) || /\.test\.(?:js|jsx)$/.test(entry.name)) return [];
    if (excludedParts.some((part) => fullPath.includes(part))) return [];
    if (fullPath.endsWith(path.join("client", "src", "data", "legalContent.js"))) return [];
    return [fullPath];
  });
}

function wordsFromFilename(filePath) {
  const basename = path.basename(filePath).replace(/\.(?:js|jsx)$/, "");
  return basename
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\bapi\b/gi, "API")
    .replace(/\bpdf\b/gi, "PDF")
    .replace(/\bhr\b/gi, "HR")
    .replace(/\bgst\b/gi, "GST")
    .replace(/\botp\b/gi, "OTP")
    .trim();
}

function identifyFeature(relativePath) {
  const value = relativePath.toLowerCase();
  const has = (...terms) => terms.some((term) => value.includes(term));

  if (has("invoicing/admin", "admininvoice", "adminreminder", "adminauditlog")) return "INVOICE - ADMIN";
  if (has("invoicing/finance", "financeinvoice", "financereminder", "vaniday")) return "INVOICE - FINANCE";
  if (has("adminpayroll")) return "PAYROLL - ADMIN";
  if (has("financepayroll", "payrollrelease", "payrollrecovery")) return "PAYROLL - FINANCE";
  if (has("hrpayroll", "hrleave", "hrloan", "hrreport", "hrroute", "publicholiday")) return "PAYROLL - HR";
  if (has("staffpayroll", "staffclaim", "staffleave", "staffloan", "staffprofile", "staffroute")) return "PAYROLL - STAFF";
  if (has("payroll", "payslip", "claim", "leave", "statutory")) return "PAYROLL - SHARED";
  if (has("invoice", "customer", "payment", "subscription", "fraud", "revenue", "overdue", "whatsapp")) return "INVOICE - SHARED";
  if (has("settings", "appearance")) return "SETTINGS - SHARED";
  if (has("auth", "session", "tenant", "role", "companyscope")) return "SECURITY / ACCESS";
  if (has("platform", "company")) return "PLATFORM / COMPANY";
  return "SHARED / APPLICATION CORE";
}

function identifyLayer(relativePath) {
  const value = relativePath.replace(/\\/g, "/").toLowerCase();
  if (value.includes("client/src/pages/")) return "Frontend page - renders a complete screen and coordinates its user interactions.";
  if (value.includes("client/src/components/")) return "Frontend component - provides reusable interface and interaction logic.";
  if (value.includes("client/src/services/")) return "Frontend service - calls backend APIs or manages browser-side application state.";
  if (value.includes("client/src/utils/")) return "Frontend utility - provides reusable data transformation or helper logic.";
  if (value.endsWith("client/src/app.jsx")) return "Frontend router - maps browser URLs and access rules to page components.";
  if (value.endsWith("client/src/main.jsx")) return "Frontend entry point - starts React and mounts the application.";
  if (value.includes("server/src/routes/")) return "Backend route - maps HTTP methods and URLs to middleware and controller functions.";
  if (value.includes("server/src/controllers/")) return "Backend controller - validates HTTP input and returns the API response.";
  if (value.includes("server/src/services/")) return "Backend service - contains reusable business rules or external integrations.";
  if (value.includes("server/src/models/")) return "Backend model - contains database queries and persistence operations.";
  if (value.includes("server/src/middleware/")) return "Backend middleware - performs checks or adds request context before controllers run.";
  if (value.includes("server/src/workers/")) return "Background worker - performs scheduled processing outside a user request.";
  if (value.includes("server/src/config/")) return "Backend configuration - initializes shared infrastructure or environment settings.";
  if (value.endsWith("server/src/app.js")) return "Backend application router - registers middleware and all API route groups.";
  if (value.endsWith("server/src/server.js")) return "Backend entry point - starts the HTTP server and background jobs.";
  return "Application support code used by other modules.";
}

function describePurpose(filePath, relativePath) {
  const name = wordsFromFilename(filePath);
  const value = relativePath.toLowerCase();
  if (value.includes("/routes/")) return `Defines the available ${name} API endpoints and connects them to handlers.`;
  if (value.includes("/controllers/")) return `Handles ${name} API requests, validation, status codes, and responses.`;
  if (value.includes("/services/")) return `Provides reusable ${name} business or integration operations.`;
  if (value.includes("/models/")) return `Reads and writes ${name} data in the database.`;
  if (value.includes("/middleware/")) return `Applies ${name} checks or context to incoming backend requests.`;
  if (value.includes("/workers/")) return `Runs scheduled ${name} background processing.`;
  if (value.includes("/pages/")) return `Implements the ${name} screen and its page-level interactions.`;
  if (value.includes("/components/")) return `Implements the reusable ${name} interface component.`;
  if (value.includes("/utils/")) return `Provides reusable ${name} helper functions.`;
  return `Implements the application's ${name} responsibilities.`;
}

function navigationHint(relativePath) {
  const value = relativePath.replace(/\\/g, "/").toLowerCase();
  if (value.includes("client/src/pages/")) return "Trace its imports for UI components and frontend services used by this screen.";
  if (value.includes("client/src/components/")) return "Use Find All References to locate the pages that render this component.";
  if (value.includes("client/src/services/")) return "Search the API path in server/src/routes to continue into the backend.";
  if (value.includes("server/src/routes/")) return "Follow the imported controller function to find request handling.";
  if (value.includes("server/src/controllers/")) return "Follow service/model calls to find business rules and database work.";
  if (value.includes("server/src/services/")) return "Use Find All References to locate controllers, workers, or services that call it.";
  if (value.includes("server/src/models/")) return "Use Find All References to locate the controller/service that requests this data.";
  if (value.includes("server/src/middleware/")) return "Search route files for this middleware to see which endpoints it protects.";
  if (value.includes("server/src/workers/")) return "Trace its imports to find the scheduler registration and services it runs.";
  return "Use Find All References on its exports to locate connected features.";
}

const files = sourceRoots.flatMap(collectFiles);
let changed = 0;

for (const filePath of files) {
  const original = fs.readFileSync(filePath, "utf8");
  if (original.includes(marker)) continue;

  const relativePath = path.relative(root, filePath).replace(/\\/g, "/");
  const header = [
    "/**",
    ` * ${marker}`,
    ` * FEATURE: ${identifyFeature(relativePath)}`,
    ` * PURPOSE: ${describePurpose(filePath, `/${relativePath}`)}`,
    ` * LAYER: ${identifyLayer(relativePath)}`,
    ` * FIND RELATED CODE: ${navigationHint(relativePath)}`,
    " */",
    "",
  ].join("\n");

  const hasBom = original.charCodeAt(0) === 0xfeff;
  const content = hasBom ? original.slice(1) : original;
  const shebangMatch = content.match(/^(#![^\r\n]+\r?\n)/);
  const updated = shebangMatch
    ? `${shebangMatch[1]}${header}${content.slice(shebangMatch[1].length)}`
    : `${header}${content}`;

  fs.writeFileSync(filePath, `${hasBom ? "\ufeff" : ""}${updated}`, "utf8");
  changed += 1;
}

console.log(`Evaluation headers added to ${changed} of ${files.length} production source files.`);
