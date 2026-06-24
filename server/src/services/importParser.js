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
  // Normalize header names for easier mapping to staff profile fields
  const headerRow = sheet.getRow(1).values.slice(1).map(v => String(v).trim());
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values.slice(1);
    const obj = {};
    for (let i = 0; i < headerRow.length; i++) {
      const rawKey = headerRow[i] || "";
      const key = rawKey
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');

      // Map common header names to canonical staff profile fields
      const headerMap = {
        'employee_id': 'employee_id',
        'staff_id': 'employee_id',
        'name': 'name',
        'staff_name': 'name',
        'email': 'email',
        'phone': 'phone',
        'hire_date': 'hire_date',
        'base_salary': 'base_salary',
        'status': 'status',
        'created_at': 'created_at',
        'updated_at': 'updated_at',
        'department_id': 'department_id',
        'user_user_id': 'user_user_id',
        'race': 'race',
        'religion': 'religion',
        'bank': 'bank',
        'account_no': 'account_no',
      };

      const mappedKey = headerMap[key] || key;
      obj[mappedKey] = values[i] ?? "";
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
