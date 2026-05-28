const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { staffProfiles, payrollRuns, payslips, payrollRateConfig, PAYSLIP_STATUSES, advanceRequests, financeRequests } = require("../services/data");
const { addAudit } = require("../services/audit");
const { pool } = require("../config/db");
const { parseFile, extractStaffNames, titleCase } = require("../services/importParser");
const { calculatePayslipsFromRows } = require("../services/payrollCalculation");
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

function upsertStaffProfile(profile) {
  if (!profile) return null;
  const employeeId = profile.employee_id || profile.staff_id;
  if (!employeeId) return null;

  const normalized = {
    ...profile,
    employee_id: employeeId,
    staff_id: profile.staff_id || employeeId,
    name: profile.name || profile.staff_name || "",
    staff_name: profile.staff_name || profile.name || "",
    email: profile.email || "",
    phone: profile.phone || ""
  };

  const index = staffProfiles.findIndex(s => s.employee_id === employeeId || s.staff_id === employeeId);
  if (index >= 0) {
    staffProfiles[index] = { ...staffProfiles[index], ...normalized };
  } else {
    staffProfiles.push(normalized);
  }

  return normalized;
}

// ----- Parameterized routes (MUST come before generic /staff routes) -----
router.get("/staff/:id", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  const { id } = req.params;
  // Prefer DB-backed lookup using `staff` table and `employee_id` column
  (async () => {
    try {
      const [rows] = await pool.query('SELECT * FROM staff WHERE employee_id = ? LIMIT 1', [id]);
      if (!rows || rows.length === 0) return res.status(404).json({ message: 'Staff record not found' });
      return res.json(rows[0]);
    } catch (err) {
      // Fallback to in-memory if DB not configured
      const staff = staffProfiles.find(s => s.staff_id === id || s.employee_id === id);
      if (!staff) return res.status(404).json({ message: 'Staff record not found' });
      return res.json(staff);
    }
  })();
});

router.put("/staff/:id", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  // Update in DB using `staff` table; fall back to in-memory
  (async () => {
    try {
      const allowed = [
        'name', 'staff_name', 'email', 'phone', 'work_location', 'department', 'base_salary', 'status',
        'hire_date', 'department_id', 'user_user_id', 'race', 'religion', 'bank', 'account_no'
      ];
      const setParts = [];
      const values = [];
      allowed.forEach((k) => {
        if (updates[k] !== undefined) {
          const col = k === 'staff_name' ? 'name' : k;
          setParts.push(`\`${col}\` = ?`);
          values.push(updates[k]);
        }
      });
      if (setParts.length === 0) return res.status(400).json({ message: 'No valid fields to update' });
      values.push(new Date().toISOString());
      values.push(id);
      const sql = `UPDATE staff SET ${setParts.join(', ')}, updated_at = ? WHERE employee_id = ?`;
      const [result] = await pool.query(sql, values);
      if (result.affectedRows === 0) {
        // fallback to in-memory
        const staff = staffProfiles.find(s => s.staff_id === id || s.employee_id === id);
        if (!staff) return res.status(404).json({ message: 'Staff record not found' });
        Object.keys(updates).forEach(k => { if (updates[k] !== undefined) staff[k] = updates[k]; });
        staff.updated_at = new Date().toISOString();
        addAudit(req.user.email, `Updated staff record ${id}`, "HR");
        return res.json({ message: 'Staff record updated (in-memory)', staff });
      }
      // fetch updated row
      const [rows] = await pool.query('SELECT * FROM staff WHERE employee_id = ? LIMIT 1', [id]);
      // write audit to audit_log table
      try {
        await pool.query('INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES (?, ?, ?, ?)',
          [`Updated staff record ${id}`, 'HR', id, req.user.userId || null]);
      } catch (e) {
        // ignore audit insert errors
      }
      return res.json({ message: 'Staff record updated successfully', staff: rows[0] });
    } catch (err) {
      // fallback to in-memory
      const staff = staffProfiles.find(s => s.staff_id === id || s.employee_id === id);
      if (!staff) return res.status(404).json({ message: 'Staff record not found' });
      Object.keys(updates).forEach(k => { if (updates[k] !== undefined) staff[k] = updates[k]; });
      staff.updated_at = new Date().toISOString();
      addAudit(req.user.email, `Updated staff record ${id}`, "HR");
      return res.json({ message: 'Staff record updated (in-memory)', staff });
    }
  })();
});

router.delete("/staff/:id", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  const { id } = req.params;
  (async () => {
    try {
      const [result] = await pool.query('DELETE FROM staff WHERE employee_id = ?', [id]);
      if (result.affectedRows === 0) {
        // fallback to in-memory
        const index = staffProfiles.findIndex(s => s.staff_id === id || s.employee_id === id);
        if (index === -1) return res.status(404).json({ message: 'Staff record not found' });
        const deletedStaff = staffProfiles.splice(index, 1)[0];
        addAudit(req.user.email, `Deleted staff record ${id}`, 'HR');
        return res.json({ message: 'Staff record deleted (in-memory)', deletedStaff });
      }
      try {
        await pool.query('INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES (?, ?, ?, ?)',
          [`Deleted staff record ${id}`, 'HR', id, req.user.userId || null]);
      } catch (e) {}
      return res.json({ message: 'Staff record deleted successfully', deletedId: id });
    } catch (err) {
      const index = staffProfiles.findIndex(s => s.staff_id === id || s.employee_id === id);
      if (index === -1) return res.status(404).json({ message: 'Staff record not found' });
      const deletedStaff = staffProfiles.splice(index, 1)[0];
      addAudit(req.user.email, `Deleted staff record ${id}`, 'HR');
      return res.json({ message: 'Staff record deleted (in-memory)', deletedStaff });
    }
  })();
});
// ----- End parameterized routes -----

router.get("/staff", authenticateToken, allowRoles("Admin", "HR"), (_req, res) => {
  (async () => {
    try {
      const [rows] = await pool.query('SELECT * FROM staff LIMIT 1000');
      // If DB has rows, return them; otherwise fall back to in-memory staffProfiles
      if (Array.isArray(rows) && rows.length > 0) return res.json(rows);
      return res.json(staffProfiles);
    } catch (err) {
      return res.json(staffProfiles);
    }
  })();
});

router.post("/staff", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  const body = req.body || {};
  (async () => {
    try {
      const employee_id = body.employee_id || body.staff_id || generateStaffId();
      const now = new Date().toISOString();
      const insertCols = [
        'employee_id','name','email','phone','work_location','department','hire_date','base_salary','status','created_at','updated_at','department_id','user_user_id','race','religion','bank','account_no'
      ];
      const values = [
        employee_id,
        body.name || body.staff_name || '',
        body.email || '',
        body.phone || '',
        body.work_location || '',
        body.department || '',
        body.hire_date || null,
        body.base_salary ? Number(body.base_salary) : 0,
        body.status || 'Active',
        now,
        now,
        body.department_id || null,
        body.user_user_id || null,
        body.race || null,
        body.religion || null,
        body.bank || null,
        body.account_no || null
      ];
      const placeholders = insertCols.map(() => '?').join(', ');
      const sql = `INSERT INTO staff (${insertCols.join(',')}) VALUES (${placeholders})`;
      const [result] = await pool.query(sql, values);
      if (result.affectedRows === 1) {
        const [rows] = await pool.query('SELECT * FROM staff WHERE employee_id = ? LIMIT 1', [employee_id]);
        upsertStaffProfile(rows[0]);
        // insert audit
        try {
          await pool.query('INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES (?, ?, ?, ?)',
            [`Added staff record ${employee_id}`, 'HR', employee_id, req.user.userId || null]);
        } catch (e) {}
        return res.status(201).json(rows[0]);
      }
      // fallback to in-memory
      const staff_id = employee_id;
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
      return res.status(201).json(profile);
    } catch (err) {
      // fallback to in-memory
      const staff_id = body.employee_id || body.staff_id || generateStaffId();
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
      return res.status(201).json(profile);
    }
  })();
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
      console.log('[EMPLOYEES UPLOAD] request received', {
        user: req.user && req.user.email ? req.user.email : null,
        file: req.file ? { originalname: req.file.originalname, path: req.file.path, size: req.file.size } : null,
        query: req.query || {},
      });
      if (!req.file) return res.status(400).json({ message: "File required (form field name: file)" });

      const rows = await parseFile(req.file.path, req.file.originalname);
      console.log('[EMPLOYEES UPLOAD] parsed rows type', Array.isArray(rows) ? 'array' : typeof rows, 'length:', rows && rows.length);
      if (Array.isArray(rows)) console.log('[EMPLOYEES UPLOAD] sample rows', rows.slice(0,3));
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

      // If ?create=true, create staff records. Prefer DB-backed staff table, then fall back to in-memory.
      const doCreate = req.query.create === "true" || req.body?.create === true;
      const created = [];
      if (doCreate) {
        for (const r of rows) {
          const get = (canonical) => {
            const actual = mapping[canonical];
            if (actual) return normalizeCellValue(r[actual]);
            return normalizeCellValue(r[canonical]);
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
          const race = get("race");
          const religion = get("religion");
          const bank = get("bank");
          const account_no = get("account_no");

          const staff_id = staff_id_candidate || generateStaffId();
          const profileName = name || "";
          const createdAt = created_at || new Date().toISOString();
          const updatedAt = updated_at || new Date().toISOString();

          try {
            const [existingRows] = await pool.query(
              "SELECT employee_id FROM staff WHERE employee_id = ? OR email = ? LIMIT 1",
              [staff_id, email || ""]
            );
            if (existingRows.length > 0) continue;

            const [result] = await pool.query(
              `INSERT INTO staff (
                employee_id, name, email, phone, work_location, hire_date, base_salary,
                status, created_at, updated_at, department_id, user_user_id,
                race, religion, bank, account_no
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                staff_id,
                profileName,
                email || null,
                phone || null,
                get("work_location") || null,
                hire_date || null,
                base_salary ? Number(base_salary) : 0,
                status || "Active",
                createdAt,
                updatedAt,
                department_id || null,
                user_user_id || null,
                race || null,
                religion || null,
                bank || null,
                account_no || null
              ]
            );

            if (result.affectedRows === 1) {
              upsertStaffProfile({
                employee_id: staff_id,
                staff_id,
                name: profileName,
                staff_name: profileName,
                email: email || "",
                phone: phone || "",
                work_location: get("work_location") || "",
                hire_date: hire_date || null,
                base_salary: base_salary ? Number(base_salary) : 0,
                status: status || "Active",
                created_at: createdAt,
                updated_at: updatedAt,
                department_id: department_id || null,
                user_user_id: user_user_id || null,
                race: race || null,
                religion: religion || null,
                bank: bank || null,
                account_no: account_no || null
              });
              created.push({
                employee_id: staff_id,
                name: profileName,
                email,
                phone,
                department_id,
                status: status || "Active"
              });
              continue;
            }
          } catch (_err) {
            const exists = staffProfiles.find(s =>
              (email && s.email && s.email.toLowerCase() === email.toLowerCase()) ||
              (staff_id && (s.staff_id === staff_id || s.employee_id === staff_id))
            );
            if (exists) continue;

            const profile = {
              staff_id,
              employee_id: staff_id,
              staff_name: titleCase(profileName),
              name: profileName,
              email: email || "",
              phone: phone || "",
              work_location: get("work_location") || "",
              department: department_id || "",
              hire_date: hire_date || "",
              base_salary: base_salary || "",
              status: status || "Active",
              created_at: createdAt,
              updated_at: updatedAt,
              department_id: department_id || "",
              user_user_id: user_user_id || "",
              race: race || "",
              religion: religion || "",
              bank: bank || "",
              account_no: account_no || ""
            };
            staffProfiles.push(profile);
            created.push(profile);
          }
        }
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
      console.error('[EMPLOYEES UPLOAD] error', err && err.stack ? err.stack : err);
      return res.status(400).json({ message: "Upload failed", error: err.message, stack: err.stack });
    }
  }
);
// ----- END: employee upload/validation + optional create endpoint -----

// ----- Payroll Run Management -----
router.post("/payroll-run", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  const { period_month, period_year } = req.body;

  if (!period_month || !period_year) {
    return res.status(400).json({ message: "period_month and period_year are required" });
  }

  const payrollRunId = `PR-${period_year}-${String(period_month).padStart(2, "0")}-${Date.now().toString(36).toUpperCase()}`;

  const payrollRun = {
    payroll_run_id: payrollRunId,
    period_month,
    period_year,
    status: "created",
    total_payslips: 0,
    approved_count: 0,
    created_at: new Date().toISOString(),
    created_by: req.user.email
  };

  payrollRuns.push(payrollRun);
  addAudit(req.user.email, `Created payroll run ${payrollRunId} for ${period_month}/${period_year}`, "HR");
  res.status(201).json(payrollRun);
});

router.get("/payroll-run", authenticateToken, allowRoles("Admin", "HR"), (_req, res) => {
  res.json(payrollRuns);
});

router.get("/payroll-run/:id", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  const run = payrollRuns.find(r => r.payroll_run_id === req.params.id);
  if (!run) {
    return res.status(404).json({ message: "Payroll run not found" });
  }
  res.json(run);
});

// ----- Payslip Generation from Upload -----
router.post(
  "/payslips/generate",
  authenticateToken,
  allowRoles("Admin", "HR"),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "File required (form field name: file)" });
      }

      const { payroll_run_id, period_month, period_year } = req.body;

      if (!payroll_run_id) {
        return res.status(400).json({ message: "payroll_run_id is required" });
      }

      // Verify payroll run exists
      const payrollRun = payrollRuns.find(r => r.payroll_run_id === payroll_run_id);
      if (!payrollRun) {
        return res.status(404).json({ message: "Payroll run not found" });
      }

      // Parse uploaded payroll file
      const rows = await parseFile(req.file.path, req.file.originalname);

      if (rows.length === 0) {
        return res.status(400).json({ message: "Uploaded file has no data rows" });
      }

      // Use payroll calculation service to generate payslips
      const { created: generatedPayslips, skipped } = calculatePayslipsFromRows(
        rows,
        staffProfiles,
        payrollRateConfig,
        payroll_run_id,
        req.user.email
      );

      // Save all generated payslips to in-memory array
      const savedPayslips = [];
      generatedPayslips.forEach((slip) => {
        payslips.push(slip);
        savedPayslips.push(slip);
      });

      // Update payroll run
      payrollRun.total_payslips = savedPayslips.length;
      payrollRun.status = "payslips_generated";

      addAudit(
        req.user.email,
        `Generated ${savedPayslips.length} payslips from ${req.file.originalname} in run ${payroll_run_id}`,
        "Payroll"
      );

      res.json({
        message: "Payslips generated successfully",
        payroll_run_id,
        generated_count: savedPayslips.length,
        skipped_count: skipped.length,
        payslips: savedPayslips,
        skipped,
        summary: {
          total_gross: generatedPayslips.reduce((sum, p) => sum + p.gross_salary, 0).toFixed(2),
          total_deductions: generatedPayslips.reduce((sum, p) => sum + p.total_deductions, 0).toFixed(2),
          total_net: generatedPayslips.reduce((sum, p) => sum + p.net_pay, 0).toFixed(2)
        }
      });
    } catch (err) {
      res.status(400).json({ message: "Payslip generation failed", error: err.message });
    }
  }
);

// ----- Payslip Retrieval -----
router.get("/payslips", authenticateToken, allowRoles("Admin", "HR", "Finance", "Staff"), (req, res) => {
  // HR/Admin sees all payslips, Finance sees only pending/approved ones, Staff sees only their sent payslips
  let filteredPayslips = payslips;

  if (req.user.role === "Finance") {
    filteredPayslips = payslips.filter(
      (p) =>
        p.status === PAYSLIP_STATUSES.FINANCE_PENDING ||
        p.status === PAYSLIP_STATUSES.ADMIN_PENDING ||
        p.status === PAYSLIP_STATUSES.FINANCE_APPROVED
    );
  } else if (req.user.role === "Staff") {
    // Staff should only see payslips that have been sent to them
    filteredPayslips = payslips.filter(
      (p) => p.staff_email && p.staff_email.toLowerCase() === req.user.email.toLowerCase() && p.status === PAYSLIP_STATUSES.SENT_TO_STAFF
    );
  }

  res.json(filteredPayslips);
});

// ----- Advance Pay Requests -----

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
}

// Create an advance request (staff or HR)
// Create an advance request — only `Staff` may create requests (HR should not create on behalf)
router.post("/advance-requests", authenticateToken, allowRoles("Staff"), (req, res) => {
  try {
    const { staff_id, requested_amount, reason } = req.body || {};
    if (!staff_id || !requested_amount) return res.status(400).json({ message: "staff_id and requested_amount are required" });

    const reqObj = {
      request_id: makeId('AR'),
      staff_id,
      requested_amount: Number(requested_amount),
      reason: reason || '',
      status: 'pending', // pending -> hr_approved -> hr_rejected -> finance_queued -> finance_processed
      created_at: new Date().toISOString(),
      created_by: req.user.email,
      approved_by: null,
      approved_at: null,
      hr_comments: null
    };

    advanceRequests.push(reqObj);
    addAudit(req.user.email, `Advance pay request created ${reqObj.request_id} for ${staff_id}`, 'Payroll');
    res.status(201).json(reqObj);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create advance request', error: err.message });
  }
});

// List advance requests (HR/Admin see all, Staff see their own)
router.get("/advance-requests", authenticateToken, allowRoles("Admin", "HR", "Staff"), (req, res) => {
  if (req.user.role === 'Staff') {
    const mine = advanceRequests.filter(a => a.created_by && a.created_by.toLowerCase() === req.user.email.toLowerCase());
    return res.json(mine);
  }
  return res.json(advanceRequests);
});

// HR approves an advance request — creates a finance queue item
// HR approval: only HR role may approve at HR step (Admin cannot approve here)
router.put("/advance-requests/:id/approve", authenticateToken, allowRoles("HR"), (req, res) => {
  try {
    const id = req.params.id;
    const reqItem = advanceRequests.find(r => r.request_id === id);
    if (!reqItem) return res.status(404).json({ message: 'Advance request not found' });
    if (reqItem.status !== 'pending') return res.status(400).json({ message: `Cannot approve request in status ${reqItem.status}` });

    reqItem.status = 'hr_approved';
    reqItem.approved_by = req.user.email;
    reqItem.approved_at = new Date().toISOString();
    reqItem.hr_comments = req.body?.hr_comments || null;

    // Create finance request entry
    const fin = {
      finance_request_id: makeId('FR'),
      advance_request_id: reqItem.request_id,
      staff_id: reqItem.staff_id,
      amount: reqItem.requested_amount,
      status: 'queued',
      created_at: new Date().toISOString(),
      created_by: req.user.email
    };
    financeRequests.push(fin);

    addAudit(req.user.email, `HR approved advance request ${id} and queued finance request ${fin.finance_request_id}`, 'Payroll');

    res.json({ message: 'Advance request approved and queued for Finance', request: reqItem, finance_request: fin });
  } catch (err) {
    res.status(500).json({ message: 'Failed to approve advance request', error: err.message });
  }
});

// HR rejects advance request
router.put("/advance-requests/:id/reject", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  try {
    const id = req.params.id;
    const reqItem = advanceRequests.find(r => r.request_id === id);
    if (!reqItem) return res.status(404).json({ message: 'Advance request not found' });
    if (reqItem.status !== 'pending') return res.status(400).json({ message: `Cannot reject request in status ${reqItem.status}` });

    reqItem.status = 'hr_rejected';
    reqItem.approved_by = req.user.email;
    reqItem.approved_at = new Date().toISOString();
    reqItem.hr_comments = req.body?.hr_comments || null;

    addAudit(req.user.email, `HR rejected advance request ${id}`, 'Payroll');
    res.json({ message: 'Advance request rejected', request: reqItem });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject advance request', error: err.message });
  }
});

// Finance: list queued finance requests
router.get('/finance-requests', authenticateToken, allowRoles('Finance'), (_req, res) => {
  try {
    return res.json(financeRequests);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch finance queue', error: err.message });
  }
});

// Finance: approve/process a finance request (only Finance role allowed)
router.put('/finance-requests/:id/approve', authenticateToken, allowRoles('Finance'), (req, res) => {
  try {
    const id = req.params.id;
    const fin = financeRequests.find(f => f.finance_request_id === id);
    if (!fin) return res.status(404).json({ message: 'Finance request not found' });
    if (fin.status !== 'queued') return res.status(400).json({ message: `Cannot process request in status ${fin.status}` });

    fin.status = 'processed';
    fin.processed_by = req.user.email;
    fin.processed_at = new Date().toISOString();

    // update corresponding advance request status
    const adv = advanceRequests.find(a => a.request_id === fin.advance_request_id);
    if (adv) {
      adv.status = 'finance_approved';
      adv.finance_approved_at = new Date().toISOString();
      adv.finance_approved_by = req.user.email;
    }

    addAudit(req.user.email, `Finance processed request ${id} for advance ${fin.advance_request_id}`, 'Payroll');
    return res.json({ message: 'Finance request processed', finance_request: fin, advance_request: adv || null });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to process finance request', error: err.message });
  }
});

router.get("/payslips/:id", authenticateToken, allowRoles("Admin", "HR", "Finance", "Staff"), (req, res) => {
  const payslip = payslips.find((p) => p.payslip_id === req.params.id);
  if (!payslip) {
    return res.status(404).json({ message: "Payslip not found" });
  }

  if (req.user.role === "Staff") {
    if (!payslip.staff_email || payslip.staff_email.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ message: "Not authorized to view this payslip" });
    }
    if (payslip.status !== PAYSLIP_STATUSES.SENT_TO_STAFF) {
      return res.status(400).json({ message: "Payslip not yet released to staff" });
    }
  }

  res.json(payslip);
});

router.put("/payslips/:id/send-to-finance", authenticateToken, allowRoles("HR", "Admin"), (req, res) => {
  const payslip = payslips.find(p => p.payslip_id === req.params.id);
  if (!payslip) return res.status(404).json({ message: "Payslip not found" });
  if (payslip.status !== PAYSLIP_STATUSES.DRAFT) {
    return res.status(400).json({ message: "Only draft payslips can be sent to Finance" });
  }
  payslip.status = PAYSLIP_STATUSES.FINANCE_PENDING;
  payslip.updated_at = new Date().toISOString();
  try {
    pool.query('INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES (?, ?, ?, ?)',
      [`Sent payslip ${req.params.id} to Finance for approval`, 'HR', req.params.id, req.user.userId || null]);
  } catch(e) {}
  return res.json({ message: "Payslip sent to Finance for approval", payslip });
});

router.get("/notifications", authenticateToken, allowRoles("HR", "Admin"), (_req, res) => {
  res.json([]);
});

module.exports = router;
