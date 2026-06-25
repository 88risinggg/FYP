import { getStoredSession } from "./sessionService.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

export async function apiRequest(path, options = {}) {
  const session = getStoredSession();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

import { clearSession, getStoredSession } from "./sessionService.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const TOKEN_KEY = "authToken";

function forceLogout() {
  clearSession();
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
    const data = await response.json().catch(() => ({}));

    if ((response.status === 401 || response.status === 403) && getStoredSession()) {
      forceLogout();
      throw new Error(data.message || "Session expired. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(data.message || "Request failed");
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.message !== "Failed to fetch") {
      throw error;
    }

    if (getStoredSession()) {
      forceLogout();
    }
    throw new Error("Server is unavailable");
  }
}

let healthCheckInterval = null;

export function startHealthCheck() {
  if (healthCheckInterval) return;

  healthCheckInterval = setInterval(async () => {
    if (!getStoredSession()) {
      stopHealthCheck();
      return;
    }

    try {
      await fetch(`${API_BASE_URL}/api/health`, { method: "GET" });
    } catch {
      forceLogout();
    }
  }, 5000);
}

export function stopHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
  }
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(content, fileName, mimeType = "text/plain") {
  downloadBlob(new Blob([content], { type: mimeType }), fileName);
}

function escapePdfText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function createTextPdfBlob(lines, title = "Document") {
  const safeLines = [title, "", ...lines].map(escapePdfText);
  const contentLines = safeLines.map((line, index) => {
    if (index === 0) {
      return `BT /F1 20 Tf 72 760 Td (${line}) Tj ET`;
    }

    if (index === 1) {
      return "BT /F1 12 Tf 72 730 Td ( ) Tj ET";
    }

    const y = 710 - (index - 2) * 18;
    return `BT /F1 12 Tf 72 ${y} Td (${line}) Tj ET`;
  });

  const stream = contentLines.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`
  ];

  const header = "%PDF-1.4\n";
  let offset = header.length;
  const offsets = ["0000000000 65535 f "];
  const body = objects.map((object) => {
    const entry = `${object}\n`;
    offsets.push(`${String(offset).padStart(10, "0")} 00000 n `);
    offset += entry.length;
    return entry;
  }).join("");

  const xrefOffset = offset;
  const xref = [
    "xref",
    "0 6",
    ...offsets,
    "trailer << /Root 1 0 R /Size 6 >>",
    "startxref",
    String(xrefOffset),
    "%%EOF"
  ].join("\n");

  const pdf = `${header}${body}${xref}`;

  return new Blob([pdf], { type: "application/pdf" });
}

export function downloadPdfLines(lines, fileName, title = "Document") {
  downloadBlob(createTextPdfBlob(lines, title), fileName);
}
