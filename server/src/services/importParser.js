const ExcelJS = require("exceljs");
const fs = require("fs");

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = values[j] ?? "";
    }
    rows.push(obj);
  }
  return rows;
}

async function parseExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const headerRow = sheet.getRow(1).values.slice(1).map(v => String(v).trim());
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values.slice(1);
    const obj = {};
    for (let i = 0; i < headerRow.length; i++) {
      obj[headerRow[i]] = values[i] ?? "";
    }
    rows.push(obj);
  });
  return rows;
}

async function parseFile(filePath, originalName = "") {
  const sourceName = originalName || filePath;
  const ext = sourceName.includes(".") ? sourceName.split(".").pop().toLowerCase() : "";
  if (ext === "csv") return parseCSV(filePath);
  return parseExcel(filePath);
}

function extractStaffNames(rows) {
  const variants = ["staff_name", "staffName", "customerName", "shop_title"];
  const set = new Set();
  rows.forEach(r => {
    for (const key of Object.keys(r)) {
      const normalizedKey = key.trim();
      if (variants.includes(normalizedKey)) {
        const value = String(r[normalizedKey] || "").trim();
        if (value) set.add(value);
      }
    }
    for (const v of variants) {
      if (r[v]) {
        const value = String(r[v]).trim();
        if (value) set.add(value);
      }
    }
  });
  return Array.from(set);
}

function titleCase(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

module.exports = {
  parseFile,
  extractStaffNames,
  titleCase
};
