/**
 * PDF Export Service
 *
 * Generates high-quality PDF reports using server-side Puppeteer.
 * Builds structured HTML documents matching the original jsPDF output,
 * then sends them to the server for PDF rendering.
 *
 * Preserves the same API surface so existing code does not need changes.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

// Constants
export const PAGE_MARGIN = 20;
export const CONTENT_WIDTH_A4 = 170;
export const CONTENT_HEIGHT_A4 = 257;
export const BRAND_COLOR = [243, 137, 120];
export const DARK_COLOR = [37, 30, 31];
export const GRAY_COLOR = [123, 102, 96];
const LIGHT_BG = [255, 248, 245];

function rgbStr(arr) {
  return `rgb(${arr[0]}, ${arr[1]}, ${arr[2]})`;
}

/**
 * Capture a DOM element as a high-resolution canvas image.
 * Handles SVG charts (Nivo) and regular DOM elements.
 *
 * @param {HTMLElement} element - DOM element to capture.
 * @param {Object} options - Capture options.
 * @returns {Promise<HTMLCanvasElement>} Rendered canvas.
 */
export async function captureElement(element, options = {}) {
  const scale = options.scale || 2;
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(rect.width * scale);
  const height = Math.ceil(rect.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Fill background
  ctx.fillStyle = options.backgroundColor || "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Try to find SVG elements (Nivo charts render as SVG)
  const svgs = element.querySelectorAll("svg");
  if (svgs.length > 0) {
    // Render SVGs directly to canvas
    ctx.scale(scale, scale);
    for (const svg of svgs) {
      const svgRect = svg.getBoundingClientRect();
      const offsetX = svgRect.left - rect.left;
      const offsetY = svgRect.top - rect.top;

      const svgClone = svg.cloneNode(true);
      svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      // Inline computed styles
      const allSvgElements = svgClone.querySelectorAll("*");
      const origElements = svg.querySelectorAll("*");
      allSvgElements.forEach((el, i) => {
        if (origElements[i]) {
          const computed = window.getComputedStyle(origElements[i]);
          const fill = computed.fill;
          const stroke = computed.stroke;
          const fontSize = computed.fontSize;
          if (fill && fill !== "none") el.setAttribute("fill", fill);
          if (stroke && stroke !== "none") el.setAttribute("stroke", stroke);
          if (fontSize) el.style.fontSize = fontSize;
        }
      });

      const svgData = new XMLSerializer().serializeToString(svgClone);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, offsetX, offsetY, svgRect.width, svgRect.height);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        img.src = url;
      });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    return canvas;
  }

  // Fallback: use SVG foreignObject for regular DOM
  const clone = element.cloneNode(true);
  const serialized = new XMLSerializer().serializeToString(clone);
  const foreignSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <foreignObject width="${rect.width}" height="${rect.height}" style="transform:scale(${scale});transform-origin:top left;">
      <body xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;">${serialized}</body>
    </foreignObject>
  </svg>`;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => resolve(canvas);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(foreignSvg)}`;
  });
}

/**
 * PDF Document Builder
 *
 * Collects pages of HTML content and generates the final document server-side.
 * Mimics the jsPDF API surface used in the financial report generation.
 */
class PdfDocument {
  constructor(orientation = "portrait") {
    this.orientation = orientation;
    this.pages = [[]]; // Array of pages, each page is an array of HTML fragments
    this.currentPage = 0;
    this._fontSize = 10;
    this._fontStyle = "normal";
    this._textColor = rgbStr(DARK_COLOR);
    this._drawColor = rgbStr([240, 210, 202]);
    this._fillColor = rgbStr(LIGHT_BG);
  }

  get internal() {
    return {
      pageSize: {
        getWidth: () => this.orientation === "landscape" ? 297 : 210,
        getHeight: () => this.orientation === "landscape" ? 210 : 297
      }
    };
  }

  setFontSize(size) { this._fontSize = size; }
  setFont(family, style) { this._fontStyle = style || "normal"; }
  setTextColor(r, g, b) {
    if (Array.isArray(r)) { this._textColor = rgbStr(r); }
    else { this._textColor = `rgb(${r}, ${g}, ${b})`; }
  }
  setFillColor(r, g, b) {
    if (Array.isArray(r)) { this._fillColor = rgbStr(r); }
    else { this._fillColor = `rgb(${r}, ${g}, ${b})`; }
  }
  setDrawColor(r, g, b) {
    if (Array.isArray(r)) { this._drawColor = rgbStr(r); }
    else { this._drawColor = `rgb(${r}, ${g}, ${b})`; }
  }
  setLineWidth() {}

  rect(x, y, w, h, mode) {
    this.pages[this.currentPage].push(
      `<div style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;background:${this._fillColor};"></div>`
    );
  }

  line(x1, y1, x2, y2) {
    const width = Math.abs(x2 - x1);
    this.pages[this.currentPage].push(
      `<div style="position:absolute;left:${x1}mm;top:${y1}mm;width:${width}mm;height:0.3mm;background:${this._drawColor};"></div>`
    );
  }

  text(content, x, y, options = {}) {
    const align = options.align || "left";
    const weight = this._fontStyle === "bold" ? "700" : "400";
    const style = `position:absolute;left:${x}mm;top:${y - this._fontSize * 0.35}mm;font-size:${this._fontSize}pt;font-weight:${weight};color:${this._textColor};white-space:nowrap;${align === "right" ? "transform:translateX(-100%);" : align === "center" ? "transform:translateX(-50%);" : ""}`;
    this.pages[this.currentPage].push(`<span style="${style}">${escapeHtml(String(content))}</span>`);
  }

  getTextWidth(text) {
    return text.length * this._fontSize * 0.2;
  }

  addPage() {
    this.currentPage++;
    this.pages[this.currentPage] = [];
  }

  addImage(imgData, format, x, y, w, h) {
    this.pages[this.currentPage].push(
      `<img src="${imgData}" style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;object-fit:contain;" />`
    );
  }

  /**
   * Build the full HTML document for Puppeteer rendering.
   */
  _buildHtml() {
    const pageWidth = this.orientation === "landscape" ? 297 : 210;
    const pageHeight = this.orientation === "landscape" ? 210 : 297;

    const pagesHtml = this.pages.map((fragments, index) => {
      const pageBreak = index < this.pages.length - 1 ? "page-break-after: always;" : "";
      return `<div class="pdf-page" style="position:relative;width:${pageWidth}mm;height:${pageHeight}mm;overflow:hidden;${pageBreak}">${fragments.join("")}</div>`;
    }).join("");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .pdf-page { position: relative; background: white; }
    @page { size: ${this.orientation === "landscape" ? "A4 landscape" : "A4"}; margin: 0; }
  </style>
</head>
<body>${pagesHtml}</body>
</html>`;
  }

  /**
   * Send to server and trigger download.
   */
  async save(fileName) {
    const html = this._buildHtml();
    const token = localStorage.getItem("authToken");

    const response = await fetch(`${API_BASE}/api/reports/generate-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ html, fileName, orientation: this.orientation })
    });

    if (!response.ok) {
      throw new Error("PDF generation failed on server");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Add a cover page to the PDF.
 */
export function addCoverPage(doc, config) {
  const { title, subtitle, generatedBy, date } = config;
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Background
  doc.pages[doc.currentPage].push(
    `<div style="position:absolute;inset:0;background:${rgbStr(LIGHT_BG)};"></div>`
  );

  // Top accent bar
  doc.pages[doc.currentPage].push(
    `<div style="position:absolute;top:0;left:0;width:100%;height:6mm;background:${rgbStr(BRAND_COLOR)};"></div>`
  );

  // Brand name
  doc.pages[doc.currentPage].push(
    `<div style="position:absolute;top:70mm;left:0;width:100%;text-align:center;font-size:42pt;font-weight:900;color:${rgbStr(BRAND_COLOR)};">Vaniday</div>`
  );

  // Title
  doc.pages[doc.currentPage].push(
    `<div style="position:absolute;top:100mm;left:0;width:100%;text-align:center;font-size:24pt;font-weight:600;color:${rgbStr(DARK_COLOR)};">${escapeHtml(title)}</div>`
  );

  // Subtitle
  if (subtitle) {
    doc.pages[doc.currentPage].push(
      `<div style="position:absolute;top:115mm;left:0;width:100%;text-align:center;font-size:14pt;color:${rgbStr(GRAY_COLOR)};">${escapeHtml(subtitle)}</div>`
    );
  }

  // Divider
  doc.pages[doc.currentPage].push(
    `<div style="position:absolute;top:130mm;left:50%;transform:translateX(-50%);width:80mm;height:0.5mm;background:${rgbStr(BRAND_COLOR)};"></div>`
  );

  // Meta
  doc.pages[doc.currentPage].push(
    `<div style="position:absolute;top:145mm;left:0;width:100%;text-align:center;font-size:11pt;color:${rgbStr(GRAY_COLOR)};">Generated: ${escapeHtml(date)}</div>`
  );
  if (generatedBy) {
    doc.pages[doc.currentPage].push(
      `<div style="position:absolute;top:153mm;left:0;width:100%;text-align:center;font-size:11pt;color:${rgbStr(GRAY_COLOR)};">Generated by: ${escapeHtml(generatedBy)}</div>`
    );
  }

  // Footer branding
  doc.pages[doc.currentPage].push(
    `<div style="position:absolute;bottom:20mm;left:0;width:100%;text-align:center;font-size:9pt;color:${rgbStr(GRAY_COLOR)};">Automated Invoice & Payroll System</div>`
  );
}

/**
 * Add a page footer with page number and branding.
 */
export function addPageFooter(doc, pageNum, totalPages, timestamp) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const bottomY = ph - 10;

  // Footer line
  doc.pages[doc.currentPage].push(
    `<div style="position:absolute;left:${PAGE_MARGIN}mm;top:${ph - 15}mm;width:${pw - PAGE_MARGIN * 2}mm;height:0.3mm;background:rgb(240,210,202);"></div>`
  );

  // Page number
  doc.pages[doc.currentPage].push(
    `<div style="position:absolute;top:${bottomY}mm;left:0;width:100%;text-align:center;font-size:8pt;color:${rgbStr(GRAY_COLOR)};">Page ${pageNum}${totalPages ? ` of ${totalPages}` : ""}</div>`
  );

  // Timestamp
  doc.pages[doc.currentPage].push(
    `<div style="position:absolute;top:${bottomY}mm;left:${PAGE_MARGIN}mm;font-size:8pt;color:${rgbStr(GRAY_COLOR)};">${escapeHtml(timestamp)}</div>`
  );

  // Brand
  doc.pages[doc.currentPage].push(
    `<div style="position:absolute;top:${bottomY}mm;right:${PAGE_MARGIN}mm;font-size:8pt;color:${rgbStr(GRAY_COLOR)};">Vaniday</div>`
  );
}

/**
 * Add a section header.
 */
export function addSectionHeader(doc, title, y) {
  doc.pages[doc.currentPage].push(
    `<div style="position:absolute;left:${PAGE_MARGIN}mm;top:${y}mm;font-size:14pt;font-weight:700;color:${rgbStr(BRAND_COLOR)};">${escapeHtml(title)}</div>`
  );
  // Underline
  const textW = title.length * 2.5;
  doc.pages[doc.currentPage].push(
    `<div style="position:absolute;left:${PAGE_MARGIN}mm;top:${y + 5}mm;width:${textW}mm;height:0.5mm;background:${rgbStr(BRAND_COLOR)};"></div>`
  );
  return y + 10;
}

/**
 * Add captured chart image to PDF.
 */
export function addChartImage(doc, canvas, y, maxWidth, maxHeight, pageContext) {
  const imgData = canvas.toDataURL("image/png");
  const imgRatio = canvas.width / canvas.height;
  let imgWidth = maxWidth || CONTENT_WIDTH_A4;
  let imgHeight = imgWidth / imgRatio;

  if (maxHeight && imgHeight > maxHeight) {
    imgHeight = maxHeight;
    imgWidth = imgHeight * imgRatio;
  }

  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + imgHeight > pageHeight - 20) {
    addPageFooter(doc, pageContext.pageNum, null, pageContext.timestamp);
    doc.addPage();
    pageContext.pageNum++;
    y = PAGE_MARGIN + 5;
  }

  doc.addImage(imgData, "PNG", PAGE_MARGIN, y, imgWidth, imgHeight);
  return y + imgHeight + 8;
}

/**
 * Add a key-value metric row.
 */
export function addMetricRow(doc, label, value, y, options = {}) {
  const pw = doc.internal.pageSize.getWidth();
  const valueColor = options.valueColor ? rgbStr(options.valueColor) : rgbStr(DARK_COLOR);

  // Label
  doc.pages[doc.currentPage].push(
    `<span style="position:absolute;left:${PAGE_MARGIN + 4}mm;top:${y}mm;font-size:10pt;color:${rgbStr(GRAY_COLOR)};">${escapeHtml(label)}</span>`
  );

  // Value (right-aligned)
  doc.pages[doc.currentPage].push(
    `<span style="position:absolute;right:${PAGE_MARGIN + 4}mm;top:${y}mm;font-size:10pt;font-weight:700;color:${valueColor};">${escapeHtml(String(value))}</span>`
  );

  return y + 6;
}

/**
 * Create a new PDF document instance.
 */
export function createPdfDocument(orientation = "portrait") {
  return new PdfDocument(orientation);
}

/**
 * Generate and download a PDF with a loading state wrapper.
 */
export async function generateAndDownloadPdf(generatorFn, fileName, { onStart, onEnd, onError, onSuccess } = {}) {
  if (onStart) onStart();
  try {
    const doc = await generatorFn();
    await doc.save(fileName);
    if (onSuccess) onSuccess();
  } catch (error) {
    console.error("PDF export failed:", error);
    if (onError) onError(error.message || "PDF export failed. Please try again.");
  } finally {
    if (onEnd) onEnd();
  }
}
