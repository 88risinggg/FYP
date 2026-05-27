const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { staffProfiles } = require("../services/data");
const { addAudit } = require("../services/audit");
const { parseFile, extractStaffNames, titleCase } = require("../services/importParser");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");

const router = express.Router();

const uploadsDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir });

function generateStaffId() {
  const next = staffProfiles.length + 1;
  return `STF${String(next).padStart(3, "0")}`;
}

// ----- Parameterized routes (MUST come before generic /staff routes) -----
router.get("/staff/:id", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  const { id } = req.params;
  const staff = staffProfiles.find(s => s.staff_id === id);
  if (!staff) return res.status(404).json({ message: "Staff record not found" });
  res.json(staff);
});

router.put("/staff/:id", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const staff = staffProfiles.find(s => s.staff_id === id);
  if (!staff) return res.status(404).json({ message: "Staff record not found" });

  const allowedUpdates = ["staff_name", "email", "phone", "department", "base_salary", "status"];
  
  allowedUpdates.forEach(field => {
    if (updates[field] !== undefined) {
      staff[field] = updates[field];
    }
  });

  addAudit(req.user.email, `Updated staff record ${id}`, "HR");
  res.json({ message: "Staff record updated successfully", staff });
});

router.delete("/staff/:id", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  const { id } = req.params;
  const index = staffProfiles.findIndex(s => s.staff_id === id);
  
  if (index === -1) return res.status(404).json({ message: "Staff record not found" });

  const deletedStaff = staffProfiles.splice(index, 1)[0];
  addAudit(req.user.email, `Deleted staff record ${id}`, "HR");
  res.json({ message: "Staff record deleted successfully", deletedStaff });
});
// ----- End parameterized routes -----

router.get("/staff", authenticateToken, allowRoles("Admin", "HR"), (_req, res) => {
  res.json(staffProfiles);
});

router.post("/staff", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  const body = req.body || {};
  const staff_id = body.staff_id || generateStaffId();
  const profile = {
    staff_id,
    staff_name: body.staff_name || body.name || "",
    email: body.email || "",
    phone: body.phone || "",
    work_location: body.work_location || "",
    department: body.department || ""
  };
  staffProfiles.push(profile);
  addAudit(req.user.email, `Added staff record ${profile.staff_id}`, "HR");
  res.status(201).json(profile);
});

router.post("/import-staff", authenticateToken, allowRoles("Admin", "HR"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File required" });
    const rows = await parseFile(req.file.path, req.file.originalname);
    const names = extractStaffNames(rows);
    const created = [];
    const existing = [];
    names.forEach(rawName => {
      const name = titleCase(rawName);
      const exists = staffProfiles.find(s => s.staff_name.toLowerCase() === name.toLowerCase());
      if (exists) {
        existing.push(exists);
        return;
      }
      const newStaff = {
        staff_id: generateStaffId(),
        staff_name: name,
        email: `${name.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "")}@company.com`,
        phone: "",
        work_location: "",
        department: ""
      };
      staffProfiles.push(newStaff);
      created.push(newStaff);
      addAudit(req.user.email, `Auto-created staff: ${newStaff.staff_name} (${newStaff.staff_id})`, "HR");
    });
    res.json({ message: `Processed ${names.length} staff names`, created, existing, total: names.length });
  } catch (err) {
    res.status(400).json({ message: "Import failed", error: err.message });
  }
});

// ----- START: employee upload/validation + optional create endpoint -----
// Expected canonical employee headers
const expectedEmployeeHeaders = [
  "employee_id",
  "name",
  "email",
  "phone",
  "hire_date",
  "base_salary",
  "status",
  "created_at",
  "updated_at",
  "department_id",
  "user_user_id"
];

// Variants mapping
const headerVariants = {
  employee_id: ["employee_id", "id", "staff_id", "employeeid", "staffid"],
  name: ["name", "staff_name", "staffname", "customername", "shop_title", "staffName"],
  email: ["email", "e-mail", "email_address"],
  phone: ["phone", "contactno", "contact_no", "contact", "phone_number"],
  hire_date: ["hire_date", "hiredate", "hired_at", "start_date", "bookedDate"],
  base_salary: ["base_salary", "salary", "basic_salary", "baseSalary", "Total_Revenue"],
  status: ["status", "employment_status", "orderStatus"],
  created_at: ["created_at", "createdat", "created"],
  updated_at: ["updated_at", "updatedat", "updated"],
  department_id: ["department_id", "departmentid", "dept_id", "dept", "shop_title"],
  user_user_id: ["user_user_id", "user_id", "useruser_id"]
};

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeCellValue(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text.trim();
    if (typeof value.hyperlink === "string") return value.hyperlink.trim();
    if (value.result !== undefined && value.result !== null) return String(value.result).trim();
    return "";
  }
  return String(value).trim();
}

function mapHeaders(foundHeaders) {
  const normalizedFound = foundHeaders.map(normalizeHeader);
  const mapping = {};
  for (const canonical of expectedEmployeeHeaders) {
    const variants = headerVariants[canonical] || [canonical];
    for (const v of variants) {
      const vnorm = normalizeHeader(v);
      const idx = normalizedFound.indexOf(vnorm);
      if (idx !== -1) {
        mapping[canonical] = foundHeaders[idx];
        break;
      }
    }
    if (!mapping[canonical]) {
      const idx2 = normalizedFound.indexOf(normalizeHeader(canonical));
      if (idx2 !== -1) mapping[canonical] = foundHeaders[idx2];
    }
  }
  return mapping;
}

router.post(
  "/employees/upload",
  authenticateToken,
  allowRoles("Admin", "HR"),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "File required (form field name: file)" });

      const rows = await parseFile(req.file.path, req.file.originalname);
      const headersFound = rows.length > 0 ? Object.keys(rows[0]).map(h => String(h).trim()) : [];

      const mapping = mapHeaders(headersFound);
      const missing = expectedEmployeeHeaders.filter(h => !mapping[h]);

      const rowErrors = [];
      rows.forEach((r, idx) => {
        const rowNum = idx + 2;
        const get = (canonical) => {
          const actual = mapping[canonical];
          if (!actual) return "";
          return normalizeCellValue(r[actual]);
        };

        if (!get("employee_id") && !get("name")) {
          rowErrors.push({ row: rowNum, error: "Missing employee_id and name" });
        }
        if (!get("hire_date")) {
          rowErrors.push({ row: rowNum, error: "Missing hire_date" });
        }
        const bs = get("base_salary");
        if (bs && isNaN(Number(bs))) {
          rowErrors.push({ row: rowNum, error: "base_salary is not numeric" });
        }
        const email = get("email");
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          rowErrors.push({ row: rowNum, error: "email format looks invalid" });
        }
      });

      const sampleRows = rows.slice(0, 10).map((r) => {
        const obj = {};
        for (const canonical of expectedEmployeeHeaders) {
          const actual = mapping[canonical];
          obj[canonical] = actual ? r[actual] ?? "" : "";
        }
        return obj;
      });

      // If ?create=true, create in-memory staffProfiles entries (skip duplicates by email or staff_name)
      const doCreate = req.query.create === "true" || req.body?.create === true;
      const created = [];
      if (doCreate) {
        rows.forEach((r) => {
          const get = (canonical) => {
            const actual = mapping[canonical];
            if (!actual) return "";
            return normalizeCellValue(r[actual]);
          };

          const name = get("name") || get("employee_name") || get("staff_name");
          const email = get("email");
          const phone = get("phone");
          const staff_id_candidate = get("employee_id") || get("staffId") || undefined;
          const hire_date = get("hire_date");
          const base_salary = get("base_salary");
          const status = get("status");
          const created_at = get("created_at");
          const updated_at = get("updated_at");
          const department_id = get("department_id");
          const user_user_id = get("user_user_id");

          const exists = staffProfiles.find(s => (email && s.email && s.email.toLowerCase() === email.toLowerCase()) || (staff_id_candidate && s.staff_id === staff_id_candidate));
          if (exists) return;

          const staff_id = staff_id_candidate || generateStaffId();
          const profile = {
            staff_id,
            employee_id: staff_id,
            staff_name: titleCase(name || ""),
            email: email || "",
            phone: phone || "",
            work_location: department_id || get("shop_title") || "",
            department: department_id || "",
            hire_date: hire_date || "",
            base_salary: base_salary || "",
            status: status || "Active",
            created_at: created_at || new Date().toISOString(),
            updated_at: updated_at || new Date().toISOString(),
            department_id: department_id || "",
            user_user_id: user_user_id || ""
          };
          staffProfiles.push(profile);
          created.push(profile);
        });
        addAudit(req.user.email, `Auto-created ${created.length} employee records from ${req.file.originalname}`, "HR");
      }

      addAudit(req.user.email, `Uploaded employee file ${req.file.originalname} (${rows.length} rows)`, "HR");

      return res.json({
        message: "File processed",
        filename: req.file.originalname,
        processedRows: rows.length,
        headersFound,
        mapping,
        missingHeaders: missing,
        rowErrors,
        sampleRows,
        createdCount: created.length,
        created
      });
    } catch (err) {
      return res.status(400).json({ message: "Upload failed", error: err.message });
    }
  }
);
// ----- END: employee upload/validation + optional create endpoint -----

module.exports = router;
