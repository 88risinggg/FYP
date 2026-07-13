// [HR BRANCH - Steven] HR module routes. Shared with payslipRoutes.js for cross-role payslip actions.
// Payslip approval workflow: HR generates (draft) → Finance approves → HR sends to staff
// Status flow: draft → finance_pending → finance_approved → sent_to_staff → rejected
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { staffProfiles, payrollRuns, payslips, payrollRateConfig, PAYSLIP_STATUSES } = require("../services/data");
const { addAudit } = require("../services/audit");
const { pool } = require("../config/db");
const { parseFile, extractStaffNames, titleCase } = require("../services/importParser");
const { calculatePayslipsFromRows } = require("../services/payrollCalculation");
const { authenticateToken } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/rolesMiddleware");
const { validateUpload } = require("../services/uploadValidationService");
const { commitUpload } = require("../services/uploadCommitService");

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

function matchesStaffSearch(record, query) {
  if (!record || !query) return false;

  const normalizedQuery = String(query).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalizedQuery) return false;

  const haystack = Object.values(record)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, " "))
    .join(" ");

  return normalizedQuery
    .split(/\s+/)
    .filter(Boolean)
    .some((token) => haystack.includes(token));
}

function buildSearchHaystack(record) {
  return Object.values(record)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, " "))
    .join(" ");
}

function recordMatchesSearch(record, query) {
  if (!record || !query) return false;

  const normalizedQuery = String(query).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!normalizedQuery) return false;

  const haystack = buildSearchHaystack(record);
  return normalizedQuery.split(/\s+/).filter(Boolean).some((token) => haystack.includes(token));
}

function normalizeSearchResult(staff) {
  return {
    employee_id: staff.employee_id || staff.staff_id || "",
    employee_code: staff.employee_code || "",
    name: staff.name || staff.staff_name || "",
    date_of_birth: staff.date_of_birth || null,
    email: staff.email || "",
    phone: staff.phone || "",
    address: staff.address || "",
    hire_date: staff.hire_date || null,
    department_id: staff.department_id || "",
    base_salary: staff.base_salary || 0,
    status: staff.status || ""
  };
}

function normalizePayrollRunResult(run) {
  return {
    type: "payroll_run",
    id: run.payroll_run_id || run.id || "",
    title: run.payroll_run_id ? `Payroll Run ${run.payroll_run_id}` : "Payroll Run",
    subtitle: [run.period_month, run.period_year, run.status, run.total_payslips ? `${run.total_payslips} payslips` : null]
      .filter(Boolean)
      .join(" • "),
    href: "/dashboard/payroll/hr/payroll-runs"
  };
}

function normalizePayslipResult(payslip) {
  return {
    type: "payslip",
    id: payslip.payslip_id || payslip.employee_id || "",
    title: payslip.staff_name || payslip.employee_id || payslip.payslip_id || "Payslip",
    subtitle: [payslip.employee_id, payslip.period_month, payslip.period_year, payslip.status]
      .filter(Boolean)
      .join(" • "),
    href: "/dashboard/payroll/hr/payslips"
  };
}

/**
 * SECURITY NOTICE: Audit logs are append-only via the routes below.
 * There are NO routes in the HR module that allow UPDATE or DELETE of the audit_log table,
 * ensuring that the history remains tamper-proof as per NFR5 requirements.
 */
router.get("/search", authenticateToken, allowRoles("Admin", "HR"), (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  if (!q) {
    return res.json([]);
  }

  (async () => {
    try {
      const [rows] = await pool.query("SELECT * FROM staff LIMIT 1000");
      const results = Array.isArray(rows)
        ? rows.filter((row) => recordMatchesSearch(row, q)).map(normalizeSearchResult)
        : [];

      if (results.length > 0) {
        const payrollRunResults = payrollRuns
          .filter((run) => recordMatchesSearch(run, q))
          .map(normalizePayrollRunResult);
        const payslipResults = payslips
          .filter((payslip) => recordMatchesSearch(payslip, q))
          .map(normalizePayslipResult);

        return res.json([...results, ...payrollRunResults, ...payslipResults].slice(0, 10));
      }
    } catch (_err) {
      // fall through to in-memory search
    }

    const staffResults = staffProfiles
      .filter((staff) => recordMatchesSearch(staff, q))
      .map(normalizeSearchResult);

    const payrollRunResults = payrollRuns
      .filter((run) => recordMatchesSearch(run, q))
      .map(normalizePayrollRunResult);

    const payslipResults = payslips
      .filter((payslip) => recordMatchesSearch(payslip, q))
      .map(normalizePayslipResult);

    return res.json([...staffResults, ...payrollRunResults, ...payslipResults].slice(0, 10));
  })();
});

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
  (async () => {
    try {
      // Only columns that actually exist in the DB staff table
      const dbColumnMap = {
        name:          'name',
        email:         'email',
        phone:         'phone',
        date_of_birth: 'date_of_birth',
        address:       'address',
        employee_code: 'employee_code',
        hire_date:     'hire_date',
        base_salary:   'base_salary',
        status:        'status',
        department_id: 'department_id',
        user_user_id:  'user_user_id',
        race:          'race',
        religion:      'religion',
        bank:          'bank',
        account_no:    'account_no'
      };

      const setParts = [];
      const values = [];

      Object.entries(dbColumnMap).forEach(([key, col]) => {
        if (updates[key] === undefined) return;
        // Skip if already added this column (e.g. staff_name after name)
        if (setParts.some(p => p.startsWith(`\`${col}\``))) return;

        let val = updates[key];

        if (key === 'status') {
          // DB is tinyint(1): 1 = active, 0 = inactive/leave/anything else
          if (val === 1 || val === '1' || String(val).toLowerCase() === 'active') val = 1;
          else val = 0;
        }

        if (key === 'hire_date' && val) {
          // DB column is date type — strip time portion if present
          val = String(val).slice(0, 10);
        }

        if (key === 'base_salary' && val !== null && val !== '') {
          val = parseFloat(val) || 0;
        }

        // Skip empty strings entirely — don't overwrite existing DB values with null
        if (val === '') return;

        setParts.push(`\`${col}\` = ?`);
        values.push(val);
      });

      if (setParts.length === 0) {
        return res.status(400).json({ message: 'No valid fields to update' });
      }

      values.push(new Date().toISOString().slice(0, 19).replace('T', ' '));
      values.push(id);
      const sql = `UPDATE staff SET ${setParts.join(', ')}, updated_at = ? WHERE employee_id = ?`;

      const [result] = await pool.query(sql, values);

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Staff record not found' });
      }

      const [rows] = await pool.query('SELECT * FROM staff WHERE employee_id = ? LIMIT 1', [id]);

      try {
        await pool.query(
          'INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES (?, ?, ?, ?)',
          [`Updated staff record ${id}`, 'HR', String(id), req.user.userId || null]
        );
      } catch (_e) { /* ignore audit errors */ }

      return res.json({ message: 'Staff record updated successfully', staff: rows[0] });
    } catch (err) {
      console.error('[PUT /staff/:id] DB error:', err.message);
      return res.status(500).json({ message: 'Failed to update staff record', error: err.message });
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
      const [rows] = await pool.query(
        'SELECT employee_id, employee_code, name, date_of_birth, email, phone, address, department_id, hire_date, status, race, religion, base_salary, bank, account_no, user_user_id, created_at, updated_at FROM staff LIMIT 1000'
      );
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
        'employee_id','employee_code','name','date_of_birth','email','phone','address',
        'department_id','hire_date','base_salary','status',
        'created_at','updated_at','user_user_id',
        'race','religion','bank','account_no'
      ];
      const values = [
        employee_id,
        body.employee_code || null,
        body.name || body.staff_name || '',
        body.date_of_birth || null,
        body.email || '',
        body.phone || '',
        body.address || null,
        body.department_id || null,
        body.hire_date || null,
        body.base_salary ? Number(body.base_salary) : 0,
        body.status || 'Active',
        now,
        now,
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
        department_id: body.department_id || ""
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
        department_id: body.department_id || ""
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
        department_id: ""
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

        const employeeId = get("employee_id");
        const employeeName = get("name");

        if (!employeeId && !employeeName) {
          rowErrors.push({ row: rowNum, error: "Missing employee_id and name" });
        }
        if (mapping.name && !String(employeeName || "").trim()) {
          rowErrors.push({ row: rowNum, error: "employee name cannot be empty" });
        }
        if (!get("hire_date")) {
          rowErrors.push({ row: rowNum, error: "Missing hire_date" });
        }
        const bs = get("base_salary");
        const numericBaseSalary = bs === "" ? null : Number(bs);
        if (bs && isNaN(numericBaseSalary)) {
          rowErrors.push({ row: rowNum, error: "base_salary is not numeric" });
        } else if (bs && numericBaseSalary < 0) {
          rowErrors.push({ row: rowNum, error: "base_salary cannot be negative" });
        } else if (bs && (!Number.isFinite(numericBaseSalary) || numericBaseSalary > Number.MAX_SAFE_INTEGER)) {
          rowErrors.push({ row: rowNum, error: "base_salary is too large" });
        }
        const email = get("email");
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          rowErrors.push({ row: rowNum, error: "email format looks invalid" });
        }
        const phoneVal = get("phone");
        if (phoneVal && /[a-zA-Z]/.test(phoneVal)) {
          rowErrors.push({ row: rowNum, error: "phone contains invalid characters" });
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
      if (doCreate && rowErrors.length === 0 && missing.length === 0) {
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
          const numericBaseSalary = base_salary === "" ? 0 : Number(base_salary);

          if (!String(profileName).trim()) {
            continue;
          }

          if (!Number.isFinite(numericBaseSalary) || numericBaseSalary > Number.MAX_SAFE_INTEGER) {
            continue;
          }
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
                employee_id, name, email, phone, date_of_birth, address, hire_date, base_salary,
                status, created_at, updated_at, department_id, user_user_id,
                race, religion, bank, account_no, employee_code
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                staff_id,
                profileName,
                email || null,
                phone || null,
                get("date_of_birth") || null,
                get("address") || null,
                hire_date || null,
                base_salary ? numericBaseSalary : 0,
                status || "Active",
                createdAt,
                updatedAt,
                department_id || null,
                user_user_id || null,
                race || null,
                religion || null,
                bank || null,
                account_no || null,
                get("employee_code") || null
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
                date_of_birth: get("date_of_birth") || "",
                address: get("address") || "",
                hire_date: hire_date || null,
                base_salary: base_salary ? numericBaseSalary : 0,
                status: status || "Active",
                created_at: createdAt,
                updated_at: updatedAt,
                department_id: department_id || null,
                user_user_id: user_user_id || null,
                race: race || null,
                religion: religion || null,
                bank: bank || null,
                account_no: account_no || null,
                employee_code: get("employee_code") || null
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
              date_of_birth: get("date_of_birth") || "",
              address: get("address") || "",
              department_id: department_id || "",
              hire_date: hire_date || "",
              base_salary: base_salary || "",
              status: status || "Active",
              created_at: createdAt,
              updated_at: updatedAt,
              user_user_id: user_user_id || "",
              race: race || "",
              religion: religion || "",
              bank: bank || "",
              account_no: account_no || "",
              employee_code: get("employee_code") || ""
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
// ----- Validate endpoint (preview & validation, no DB writes) -----
router.post(
  "/employees/validate",
  authenticateToken,
  allowRoles("Admin", "HR"),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "File required" });
      const result = await validateUpload(req.file.path, req.file.originalname, req.user.email);
      return res.json(result);
    } catch (err) {
      if (
        err.message.includes("Unsupported file format") ||
        err.message.includes("no data rows") ||
        err.message.includes("exceeds maximum")
      ) {
        return res.status(400).json({ message: err.message });
      }
      if (err.message.includes("service unavailability")) {
        return res.status(500).json({ message: err.message });
      }
      return res.status(500).json({ message: "Validation failed", error: err.message });
    }
  }
);
// ----- END: employee upload/validation + optional create endpoint -----

// ----- Commit endpoint (persist selected validated rows) -----
router.post(
  "/employees/commit",
  authenticateToken,
  allowRoles("Admin", "HR"),
  async (req, res) => {
    try {
      const { sessionId, selectedRowIds } = req.body;

      // Input validation
      if (!sessionId || !selectedRowIds || !Array.isArray(selectedRowIds) || selectedRowIds.length === 0) {
        return res.status(400).json({ message: "sessionId and non-empty selectedRowIds array are required" });
      }
      if (selectedRowIds.length > 5000) {
        return res.status(400).json({ message: "Selection exceeds maximum allowed count of 5000" });
      }

      const result = await commitUpload(sessionId, selectedRowIds, req.user.email);

      // If concurrent conflicts detected, return 409
      if (result.conflicts && result.conflicts.length > 0) {
        return res.status(409).json({ ...result, message: "Some records had concurrent conflicts" });
      }

      return res.json(result);
    } catch (err) {
      // Map error messages to HTTP status codes
      if (err.message.includes("expired") || err.message.includes("not found")) {
        return res.status(410).json({ message: err.message });
      }
      if (err.message.includes("forbidden") || err.message.includes("another user")) {
        return res.status(403).json({ message: err.message });
      }
      if (err.message.includes("non-empty") || err.message.includes("exceeds maximum")) {
        return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: "Commit failed", error: err.message });
    }
  }
);
// ----- END: commit endpoint -----

// ----- Payroll Run Management (DB-backed) -----
// [HR BRANCH - Steven] Migrated from in-memory payrollRuns[] to payroll_run table
router.post("/payroll-run", authenticateToken, allowRoles("Admin", "HR"), async (req, res) => {
  try {
    const { period_month, period_year } = req.body;

    if (!period_month || !period_year) {
      return res.status(400).json({ message: "period_month and period_year are required" });
    }

    // Convert period_month to numeric if it's a string name (e.g., "June" → 6)
    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    let numMonth = Number(period_month);
    if (isNaN(numMonth)) {
      const idx = monthNames.findIndex(m => m.toLowerCase() === String(period_month).toLowerCase());
      numMonth = idx >= 0 ? idx + 1 : null;
    }
    if (!numMonth || numMonth < 1 || numMonth > 12) {
      return res.status(400).json({ message: "Invalid period_month" });
    }
    const numYear = Number(period_year);

    // FR1: Ensure same period doesn't create redundant runs
    const [existing] = await pool.query(
      'SELECT payroll_run_id FROM payroll_run WHERE payroll_month = ? AND payroll_year = ? LIMIT 1',
      [numMonth, numYear]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        message: `A payroll run already exists for ${period_month} ${period_year}`,
        run: existing[0]
      });
    }

    const [result] = await pool.query(
      'INSERT INTO payroll_run (payroll_month, payroll_year, status, created_by, created_at) VALUES (?, ?, ?, ?, NOW())',
      [numMonth, numYear, 'Draft', req.user.userId]
    );

    const [rows] = await pool.query('SELECT * FROM payroll_run WHERE payroll_run_id = ? LIMIT 1', [result.insertId]);
    const run = rows[0];

    addAudit(req.user.email, `Created payroll run ${run.payroll_run_id} for ${numMonth}/${numYear}`, "HR");
    res.status(201).json(run);
  } catch (err) {
    res.status(500).json({ message: "Failed to create payroll run", error: err.message });
  }
});

router.get("/payroll-run", authenticateToken, allowRoles("Admin", "HR"), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pr.*, u.name AS created_by_name,
        (SELECT COUNT(*) FROM payroll p WHERE p.payroll_run_id = pr.payroll_run_id) AS total_payslips
       FROM payroll_run pr
       LEFT JOIN user u ON pr.created_by = u.user_id
       ORDER BY pr.payroll_year DESC, pr.payroll_month DESC`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch payroll runs", error: err.message });
  }
});

router.get("/payroll-run/:id", authenticateToken, allowRoles("Admin", "HR"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT pr.*, u.name AS created_by_name,
        (SELECT COUNT(*) FROM payroll p WHERE p.payroll_run_id = pr.payroll_run_id) AS total_payslips
       FROM payroll_run pr
       LEFT JOIN user u ON pr.created_by = u.user_id
       WHERE pr.payroll_run_id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Payroll run not found" });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch payroll run", error: err.message });
  }
});

// GET /api/hr/payroll-run/:id/payslips — Get all staff payroll records for a run, sorted by employee_id ASC
router.get("/payroll-run/:id/payslips", authenticateToken, allowRoles("Admin", "HR"), async (req, res) => {
  try {
    const [runCheck] = await pool.query(
      "SELECT payroll_run_id FROM payroll_run WHERE payroll_run_id = ? LIMIT 1",
      [req.params.id]
    );
    if (!runCheck.length) return res.status(404).json({ message: "Payroll run not found" });

    const [rows] = await pool.query(
      `SELECT 
        p.payroll_id,
        p.staff_employee_id AS employee_id,
        s.name AS staff_name,
        s.email,
        s.department_id,
        s.base_salary,
        p.total_allowances,
        p.total_deductions,
        p.net_salary,
        ps.payslip_id,
        ps.status AS payslip_status
      FROM payroll p
      JOIN staff s ON s.employee_id = p.staff_employee_id
      LEFT JOIN payslip ps ON ps.payroll_payroll_id = p.payroll_id
      WHERE p.payroll_run_id = ?
      ORDER BY p.staff_employee_id ASC`,
      [req.params.id]
    );

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch payroll run details", error: err.message });
  }
});

router.put("/payroll-run/:id/lock", authenticateToken, allowRoles("Admin", "HR"), async (req, res) => {
  try {
    // 1. Fetch current payroll run
    const [rows] = await pool.query(
      "SELECT payroll_run_id, status FROM payroll_run WHERE payroll_run_id = ? LIMIT 1",
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Payroll run not found" });
    }

    // 2. Validate lockable status — only finance-approved runs can be sent to staff
    const run = rows[0];
    const lockableStatuses = ["finance_approved"];
    if (!lockableStatuses.includes(run.status)) {
      return res.status(400).json({
        message: `Cannot lock payroll run with status "${run.status}". Finance approval is required before sending to staff.`
      });
    }

    // 3. Update status to Closed
    await pool.query(
      "UPDATE payroll_run SET status = ? WHERE payroll_run_id = ?",
      ["Closed", req.params.id]
    );

    // 4. Return enriched payroll run (same shape as GET /payroll-run/:id)
    const [updated] = await pool.query(
      `SELECT pr.*, u.name AS created_by_name,
        (SELECT COUNT(*) FROM payroll p WHERE p.payroll_run_id = pr.payroll_run_id) AS total_payslips
       FROM payroll_run pr
       LEFT JOIN user u ON pr.created_by = u.user_id
       WHERE pr.payroll_run_id = ? LIMIT 1`,
      [req.params.id]
    );

    // 5. Audit log
    addAudit(req.user.email, `Locked payroll run ${req.params.id}`, "HR");

    return res.json(updated[0]);
  } catch (err) {
    return res.status(500).json({ message: "Failed to lock payroll run", error: err.message });
  }
});

// ----- Payslip Generation from Upload (DB-backed) -----
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

      // Verify payroll run exists in DB
      const [runRows] = await pool.query('SELECT * FROM payroll_run WHERE payroll_run_id = ? LIMIT 1', [payroll_run_id]);
      if (!runRows.length) {
        return res.status(404).json({ message: "Payroll run not found" });
      }
      const payrollRun = runRows[0];

      // Parse uploaded payroll file
      const rows = await parseFile(req.file.path, req.file.originalname);

      if (rows.length === 0) {
        return res.status(400).json({ message: "Uploaded file has no data rows" });
      }

      // Get active staff from DB
      const [staffFromDb] = await pool.query("SELECT * FROM staff WHERE status = 1 OR status = 'Active'");

      // Use payroll calculation service to generate payslips
      const { created: generatedPayslips, skipped } = calculatePayslipsFromRows(
        rows,
        staffFromDb,
        payrollRateConfig,
        String(payroll_run_id),
        req.user.email
      );

      // Save to DB: INSERT into payroll + payslip tables
      const savedPayslips = [];
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        for (const slip of generatedPayslips) {
          // Check for duplicate (same employee + same run)
          const [dupCheck] = await conn.query(
            'SELECT payroll_id FROM payroll WHERE staff_employee_id = ? AND payroll_run_id = ? LIMIT 1',
            [slip.employee_id, payroll_run_id]
          );
          if (dupCheck.length > 0) {
            skipped.push({ row_identifier: slip.employee_id, reason: 'Duplicate payslip for run' });
            continue;
          }

          // Insert payroll record
          const [payrollResult] = await conn.query(
            `INSERT INTO payroll 
              (staff_employee_id, payroll_month, payroll_year, payroll_run_id, total_allowances, total_deductions, net_salary)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              slip.employee_id,
              payrollRun.payroll_month,
              payrollRun.payroll_year,
              payroll_run_id,
              slip.allowance || 0,
              slip.total_deductions || 0,
              slip.net_pay || 0
            ]
          );

          // Insert payslip record
          await conn.query(
            'INSERT INTO payslip (payroll_payroll_id, status, generated_at) VALUES (?, ?, NOW())',
            [payrollResult.insertId, 'draft']
          );

          // Insert allowance line items if any
          if (slip.allowance > 0) {
            await conn.query(
              'INSERT INTO payroll_allowance (payroll_payroll_id, allowance_type, amount) VALUES (?, ?, ?)',
              [payrollResult.insertId, 'Allowance', slip.allowance]
            );
          }
          if (slip.services_commission > 0) {
            await conn.query(
              'INSERT INTO payroll_allowance (payroll_payroll_id, allowance_type, amount) VALUES (?, ?, ?)',
              [payrollResult.insertId, 'Services Commission', slip.services_commission]
            );
          }
          if (slip.product_commission > 0) {
            await conn.query(
              'INSERT INTO payroll_allowance (payroll_payroll_id, allowance_type, amount) VALUES (?, ?, ?)',
              [payrollResult.insertId, 'Product Commission', slip.product_commission]
            );
          }
          if (slip.credit_commission > 0) {
            await conn.query(
              'INSERT INTO payroll_allowance (payroll_payroll_id, allowance_type, amount) VALUES (?, ?, ?)',
              [payrollResult.insertId, 'Credit Commission', slip.credit_commission]
            );
          }

          // Insert deduction line items if any
          if (slip.cpf_employee_deduction > 0) {
            await conn.query(
              'INSERT INTO payroll_deduction (payroll_payroll_id, deduction_type, amount) VALUES (?, ?, ?)',
              [payrollResult.insertId, 'CPF Employee', slip.cpf_employee_deduction]
            );
          }
          if (slip.loan_deduction > 0) {
            await conn.query(
              'INSERT INTO payroll_deduction (payroll_payroll_id, deduction_type, amount) VALUES (?, ?, ?)',
              [payrollResult.insertId, 'Loan', slip.loan_deduction]
            );
          }
          if (slip.other_deduction > 0) {
            await conn.query(
              'INSERT INTO payroll_deduction (payroll_payroll_id, deduction_type, amount) VALUES (?, ?, ?)',
              [payrollResult.insertId, 'Other', slip.other_deduction]
            );
          }
          if (slip.donation_amount > 0) {
            await conn.query(
              'INSERT INTO payroll_deduction (payroll_payroll_id, deduction_type, amount) VALUES (?, ?, ?)',
              [payrollResult.insertId, slip.donation_fund || 'Donation', slip.donation_amount]
            );
          }

          savedPayslips.push(slip);
        }

        // Update payroll run status
        await conn.query(
          'UPDATE payroll_run SET status = ?, updated_at = NOW() WHERE payroll_run_id = ?',
          ['Payslips Generated', payroll_run_id]
        );

        await conn.commit();
      } catch (dbErr) {
        await conn.rollback();
        throw dbErr;
      } finally {
        conn.release();
      }

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
          total_gross: savedPayslips.reduce((sum, p) => sum + p.gross_salary, 0).toFixed(2),
          total_deductions: savedPayslips.reduce((sum, p) => sum + p.total_deductions, 0).toFixed(2),
          total_net: savedPayslips.reduce((sum, p) => sum + p.net_pay, 0).toFixed(2)
        }
      });
    } catch (err) {
      res.status(400).json({ message: "Payslip generation failed", error: err.message });
    }
  }
);

// ----- Quick Generate: Create payslips from DB data (no file upload needed) -----
// Uses base_salary from staff table + CPF/SDL calculation
router.post("/payslips/quick-generate", authenticateToken, allowRoles("Admin", "HR"), async (req, res) => {
  try {
    const { period_month, period_year } = req.body || {};
    if (!period_month || !period_year) {
      return res.status(400).json({ message: "period_month and period_year are required" });
    }

    const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    let numMonth = Number(period_month);
    if (isNaN(numMonth)) {
      const idx = monthNames.findIndex(m => m.toLowerCase() === String(period_month).toLowerCase());
      numMonth = idx >= 0 ? idx + 1 : null;
    }
    if (!numMonth || numMonth < 1 || numMonth > 12) {
      return res.status(400).json({ message: "Invalid period_month" });
    }
    const numYear = Number(period_year);

    // Check if payroll run already exists for this period
    const [existingRun] = await pool.query(
      'SELECT payroll_run_id FROM payroll_run WHERE payroll_month = ? AND payroll_year = ? LIMIT 1',
      [numMonth, numYear]
    );
    if (existingRun.length > 0) {
      return res.status(409).json({ message: `A payroll run already exists for ${period_month} ${period_year}. Use the existing run or choose a different period.` });
    }

    // Get all active staff from DB
    const [staffList] = await pool.query("SELECT * FROM staff WHERE status = 1");
    if (staffList.length === 0) {
      return res.status(400).json({ message: "No active staff found in database" });
    }

    // Get donation settings from payroll_setting if available
    let donationConfig = {};
    try {
      const [settings] = await pool.query("SELECT setting_key, setting_value FROM payroll_setting WHERE setting_key LIKE 'donation_%'");
      settings.forEach(s => {
        try { donationConfig[s.setting_key] = JSON.parse(s.setting_value); } catch (_) { donationConfig[s.setting_key] = s.setting_value; }
      });
    } catch (_) { /* no donation settings, that's OK */ }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Create payroll run
      const [runResult] = await conn.query(
        'INSERT INTO payroll_run (payroll_month, payroll_year, status, created_by, created_at) VALUES (?, ?, ?, ?, NOW())',
        [numMonth, numYear, 'Payslips Generated', req.user.userId]
      );
      const payrollRunId = runResult.insertId;

      const generated = [];
      const skipped = [];

      for (const staff of staffList) {
        const baseSalary = parseFloat(staff.base_salary) || 0;
        if (baseSalary <= 0) {
          skipped.push({ employee_id: staff.employee_id, name: staff.name, reason: 'No base salary' });
          continue;
        }

        // Calculate CPF
        const cpfEmployee = baseSalary * payrollRateConfig.employeeCpfRate;
        const cpfEmployer = baseSalary * payrollRateConfig.employerCpfRate;
        const sdl = cpfEmployer * payrollRateConfig.sdlRate;

        // Calculate donation based on religion
        let donationAmount = 0;
        const religionKey = String(staff.religion || '').toLowerCase().trim();
        if (payrollRateConfig.donations && payrollRateConfig.donations[religionKey]) {
          const dc = payrollRateConfig.donations[religionKey];
          donationAmount = (baseSalary * (Number(dc.rate) || 0)) + (Number(dc.amount) || 0);
        }

        const totalDeductions = parseFloat((cpfEmployee + donationAmount).toFixed(2));
        const netSalary = parseFloat((baseSalary - totalDeductions).toFixed(2));

        // Insert payroll record
        const [payrollResult] = await conn.query(
          `INSERT INTO payroll 
            (staff_employee_id, payroll_month, payroll_year, payroll_run_id, total_allowances, total_deductions, net_salary)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [staff.employee_id, numMonth, numYear, payrollRunId, 0, totalDeductions, netSalary]
        );

        // Insert payslip record
        await conn.query(
          'INSERT INTO payslip (payroll_payroll_id, status, generated_at) VALUES (?, ?, NOW())',
          [payrollResult.insertId, 'draft']
        );

        // Insert CPF deduction line item
        if (cpfEmployee > 0) {
          await conn.query(
            'INSERT INTO payroll_deduction (payroll_payroll_id, deduction_type, amount) VALUES (?, ?, ?)',
            [payrollResult.insertId, 'CPF Employee', parseFloat(cpfEmployee.toFixed(2))]
          );
        }

        // Insert donation deduction if applicable
        if (donationAmount > 0) {
          await conn.query(
            'INSERT INTO payroll_deduction (payroll_payroll_id, deduction_type, amount) VALUES (?, ?, ?)',
            [payrollResult.insertId, 'MBMF/SINDA/CDAC', parseFloat(donationAmount.toFixed(2))]
          );
        }

        generated.push({
          employee_id: staff.employee_id,
          name: staff.name,
          base_salary: baseSalary,
          cpf_employee: parseFloat(cpfEmployee.toFixed(2)),
          cpf_employer: parseFloat(cpfEmployer.toFixed(2)),
          total_deductions: totalDeductions,
          net_salary: netSalary
        });
      }

      await conn.commit();

      addAudit(req.user.email, `Quick-generated ${generated.length} payslips for ${numMonth}/${numYear}`, 'Payroll');

      res.status(201).json({
        message: "Payslips generated successfully from database",
        payroll_run_id: payrollRunId,
        period: { month: numMonth, year: numYear },
        generated_count: generated.length,
        skipped_count: skipped.length,
        generated,
        skipped,
        summary: {
          total_gross: generated.reduce((sum, p) => sum + p.base_salary, 0).toFixed(2),
          total_deductions: generated.reduce((sum, p) => sum + p.total_deductions, 0).toFixed(2),
          total_net: generated.reduce((sum, p) => sum + p.net_salary, 0).toFixed(2)
        }
      });
    } catch (dbErr) {
      await conn.rollback();
      throw dbErr;
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(500).json({ message: "Quick generate failed", error: err.message });
  }
});

// ----- Payslip Retrieval -----
router.get("/payslips", authenticateToken, allowRoles("Admin", "HR", "Finance", "Staff"), async (req, res) => {
  // HR/Admin sees all payslips, Finance sees only pending/approved ones, Staff sees only their sent payslips
  // Optional query params: ?month=7&year=2026 to filter by period
  try {
    let sql = `
      SELECT
        ps.payslip_id,
        ps.status,
        ps.file_path,
        ps.generated_at,
        ps.sent_to_staff_at,
        ps.updated_at,
        p.payroll_month AS period_month,
        p.payroll_year AS period_year,
        p.net_salary AS net_pay,
        p.total_allowances,
        p.total_deductions,
        s.name AS staff_name,
        s.employee_id,
        s.email AS staff_email,
        s.base_salary,
        s.department_id
      FROM payslip ps
      JOIN payroll p ON ps.payroll_payroll_id = p.payroll_id
      JOIN staff s ON p.staff_employee_id = s.employee_id
    `;
    const params = [];
    const conditions = [];

    if (req.user.role === "Finance") {
      conditions.push("ps.status IN (?, ?)");
      params.push('finance_pending', 'finance_approved');
    } else if (req.user.role === "Staff") {
      conditions.push("s.user_user_id = ? AND ps.status = ?");
      params.push(req.user.userId, 'sent_to_staff');
    }

    // Month/year filter
    const filterMonth = req.query.month ? Number(req.query.month) : null;
    const filterYear = req.query.year ? Number(req.query.year) : null;
    if (filterMonth && filterYear) {
      conditions.push("p.payroll_month = ? AND p.payroll_year = ?");
      params.push(filterMonth, filterYear);
    } else if (filterYear) {
      conditions.push("p.payroll_year = ?");
      params.push(filterYear);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY ps.generated_at DESC";

    const [rows] = await pool.query(sql, params);
    return res.json(rows);
  } catch (err) {
    // Fallback to in-memory if DB query fails (e.g. tables not yet created)
    let filteredPayslips = payslips;
    if (req.user.role === "Finance") {
      filteredPayslips = payslips.filter(
        (p) => p.status === PAYSLIP_STATUSES.FINANCE_PENDING || p.status === PAYSLIP_STATUSES.FINANCE_APPROVED
      );
    } else if (req.user.role === "Staff") {
      filteredPayslips = payslips.filter(
        (p) => p.staff_email && p.staff_email.toLowerCase() === req.user.email.toLowerCase() && p.status === PAYSLIP_STATUSES.SENT_TO_STAFF
      );
    }
    return res.json(filteredPayslips);
  }
});

// [HR BRANCH - Steven] Advance payment endpoints — migrated from in-memory to MySQL
// Tables: advance_request, finance_request (created by Staff/HR branch)
// Do not revert to in-memory arrays

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
}

// Create an advance request — only `Staff` may create requests (HR should not create on behalf)
router.post("/advance-requests", authenticateToken, allowRoles("Staff"), async (req, res) => {
  try {
    const { requested_amount, reason } = req.body || {};
    if (!requested_amount) return res.status(400).json({ message: "requested_amount is required" });

    // Derive staff_employee_id from JWT userId
    const [staffRows] = await pool.query('SELECT employee_id FROM staff WHERE user_user_id = ? LIMIT 1', [req.user.userId]);
    if (!staffRows.length) return res.status(400).json({ message: "Staff profile not found for current user" });
    const staffEmployeeId = staffRows[0].employee_id;

    const requestId = makeId('AR');
    await pool.query(
      `INSERT INTO advance_request 
        (request_id, staff_employee_id, requested_amount, reason, status, created_at, created_by, approved_by, approved_at, hr_comments)
       VALUES (?, ?, ?, ?, 'pending', NOW(), ?, NULL, NULL, NULL)`,
      [requestId, staffEmployeeId, Number(requested_amount), reason || '', req.user.userId]
    );

    const [rows] = await pool.query(
      'SELECT request_id, staff_employee_id AS staff_id, requested_amount, reason, status, created_at, created_by, approved_by, approved_at, hr_comments FROM advance_request WHERE request_id = ? LIMIT 1',
      [requestId]
    );

    addAudit(req.user.email, `Advance pay request created ${requestId} for employee ${staffEmployeeId}`, 'Payroll');
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create advance request', error: err.message });
  }
});

// List advance requests (HR/Admin see all, Staff see their own)
router.get("/advance-requests", authenticateToken, allowRoles("Admin", "HR", "Staff"), async (req, res) => {
  try {
    if (req.user.role === 'Staff') {
      const [rows] = await pool.query(
        `SELECT ar.request_id, ar.staff_employee_id AS staff_id, ar.requested_amount, ar.reason, ar.status, ar.created_at, ar.created_by, ar.approved_by, ar.approved_at, ar.hr_comments
         FROM advance_request ar
         JOIN staff s ON ar.staff_employee_id = s.employee_id
         WHERE s.user_user_id = ?
         ORDER BY ar.created_at DESC`,
        [req.user.userId]
      );
      return res.json(rows);
    }
    const [rows] = await pool.query(
      'SELECT request_id, staff_employee_id AS staff_id, requested_amount, reason, status, created_at, created_by, approved_by, approved_at, hr_comments FROM advance_request ORDER BY created_at DESC'
    );
    return res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch advance requests', error: err.message });
  }
});

// HR approves an advance request — creates a finance queue item (transaction)
// HR approval: only HR role may approve at HR step (Admin cannot approve here)
router.put("/advance-requests/:id/approve", authenticateToken, allowRoles("HR"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const id = req.params.id;

    const [advRows] = await conn.query('SELECT * FROM advance_request WHERE request_id = ? LIMIT 1', [id]);
    if (!advRows.length) { await conn.rollback(); return res.status(404).json({ message: 'Advance request not found' }); }
    const advRow = advRows[0];
    if (advRow.status !== 'pending') { await conn.rollback(); return res.status(400).json({ message: `Cannot approve request in status ${advRow.status}` }); }

    const hrComments = req.body?.hr_comments || null;
    await conn.query(
      'UPDATE advance_request SET status = ?, approved_by = ?, approved_at = NOW(), hr_comments = ? WHERE request_id = ? AND status = ?',
      ['hr_approved', req.user.userId, hrComments, id, 'pending']
    );

    const finId = makeId('FR');
    await conn.query(
      `INSERT INTO finance_request 
        (finance_request_id, advance_request_id, staff_employee_id, amount, status, created_at, created_by, processed_by, processed_at)
       VALUES (?, ?, ?, ?, 'queued', NOW(), ?, NULL, NULL)`,
      [finId, id, advRow.staff_employee_id, advRow.requested_amount, req.user.userId]
    );

    await conn.commit();

    const [updatedRows] = await pool.query(
      'SELECT request_id, staff_employee_id AS staff_id, requested_amount, reason, status, created_at, created_by, approved_by, approved_at, hr_comments FROM advance_request WHERE request_id = ? LIMIT 1',
      [id]
    );
    const [finRows] = await pool.query(
      'SELECT finance_request_id, advance_request_id, staff_employee_id AS staff_id, amount, status, created_at, created_by, processed_by, processed_at FROM finance_request WHERE finance_request_id = ? LIMIT 1',
      [finId]
    );

    addAudit(req.user.email, `HR approved advance request ${id} and queued finance request ${finId}`, 'Payroll');
    res.json({ message: 'Advance request approved and queued for Finance', request: updatedRows[0], finance_request: finRows[0] });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Failed to approve advance request', error: err.message });
  } finally {
    conn.release();
  }
});

// HR rejects advance request
router.put("/advance-requests/:id/reject", authenticateToken, allowRoles("Admin", "HR"), async (req, res) => {
  try {
    const id = req.params.id;

    const [advRows] = await pool.query('SELECT * FROM advance_request WHERE request_id = ? LIMIT 1', [id]);
    if (!advRows.length) return res.status(404).json({ message: 'Advance request not found' });
    if (advRows[0].status !== 'pending') return res.status(400).json({ message: `Cannot reject request in status ${advRows[0].status}` });

    const hrComments = req.body?.hr_comments || null;
    await pool.query(
      'UPDATE advance_request SET status = ?, approved_by = ?, approved_at = NOW(), hr_comments = ? WHERE request_id = ? AND status = ?',
      ['hr_rejected', req.user.userId, hrComments, id, 'pending']
    );

    const [updatedRows] = await pool.query(
      'SELECT request_id, staff_employee_id AS staff_id, requested_amount, reason, status, created_at, created_by, approved_by, approved_at, hr_comments FROM advance_request WHERE request_id = ? LIMIT 1',
      [id]
    );

    addAudit(req.user.email, `HR rejected advance request ${id}`, 'Payroll');
    res.json({ message: 'Advance request rejected', request: updatedRows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject advance request', error: err.message });
  }
});

// Finance: list queued finance requests
router.get('/finance-requests', authenticateToken, allowRoles('Finance'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT finance_request_id, advance_request_id, staff_employee_id AS staff_id, amount, status, created_at, created_by, processed_by, processed_at FROM finance_request ORDER BY created_at DESC'
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch finance queue', error: err.message });
  }
});

// Finance: approve/process a finance request (transaction — only Finance role allowed)
router.put('/finance-requests/:id/approve', authenticateToken, allowRoles('Finance'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const id = req.params.id;

    const [finRows] = await conn.query('SELECT * FROM finance_request WHERE finance_request_id = ? LIMIT 1', [id]);
    if (!finRows.length) { await conn.rollback(); return res.status(404).json({ message: 'Finance request not found' }); }
    const finRow = finRows[0];
    if (finRow.status !== 'queued') { await conn.rollback(); return res.status(400).json({ message: `Cannot process request in status ${finRow.status}` }); }

    await conn.query(
      'UPDATE finance_request SET status = ?, processed_by = ?, processed_at = NOW() WHERE finance_request_id = ? AND status = ?',
      ['processed', req.user.userId, id, 'queued']
    );

    await conn.query(
      'UPDATE advance_request SET status = ? WHERE request_id = ?',
      ['finance_approved', finRow.advance_request_id]
    );

    await conn.commit();

    const [updatedFin] = await pool.query(
      'SELECT finance_request_id, advance_request_id, staff_employee_id AS staff_id, amount, status, created_at, created_by, processed_by, processed_at FROM finance_request WHERE finance_request_id = ? LIMIT 1',
      [id]
    );
    const [updatedAdv] = await pool.query(
      'SELECT request_id, staff_employee_id AS staff_id, requested_amount, reason, status, created_at, created_by, approved_by, approved_at, hr_comments FROM advance_request WHERE request_id = ? LIMIT 1',
      [finRow.advance_request_id]
    );

    addAudit(req.user.email, `Finance processed request ${id} for advance ${finRow.advance_request_id}`, 'Payroll');
    return res.json({ message: 'Finance request processed', finance_request: updatedFin[0], advance_request: updatedAdv[0] || null });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ message: 'Failed to process finance request', error: err.message });
  } finally {
    conn.release();
  }
});

// [Employee Loan Module] — Loan request endpoints
// Table: loan_request (created by Staff, managed by HR)

// Create a loan request — only `Staff` may create requests
router.post("/loan-requests", authenticateToken, allowRoles("Staff"), async (req, res) => {
  try {
    const { requested_amount, repayment_months, reason } = req.body || {};

    // Validate requested_amount
    if (!requested_amount || Number(requested_amount) < 1 || Number(requested_amount) > 50000) {
      return res.status(400).json({ message: "Requested amount must be between 1 and 50000" });
    }

    // Validate repayment_months
    if (!repayment_months || Number(repayment_months) < 1 || Number(repayment_months) > 36) {
      return res.status(400).json({ message: "Repayment period must be between 1 and 36 months" });
    }

    // Derive staff_employee_id from JWT userId
    const [staffRows] = await pool.query('SELECT employee_id FROM staff WHERE user_user_id = ? LIMIT 1', [req.user.userId]);
    if (!staffRows.length) return res.status(400).json({ message: "Staff profile not found for current user" });
    const staffEmployeeId = staffRows[0].employee_id;

    const loanId = makeId('LN');
    await pool.query(
      `INSERT INTO loan_request 
        (loan_id, staff_employee_id, requested_amount, repayment_months, reason, status, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, 'pending', NOW(), ?)`,
      [loanId, staffEmployeeId, Number(requested_amount), Number(repayment_months), reason || '', req.user.userId]
    );

    const [rows] = await pool.query(
      `SELECT loan_id, staff_employee_id, requested_amount, repayment_months, reason, status, 
              monthly_installment, total_paid, outstanding_balance, created_at, created_by, 
              approved_by, approved_at, hr_comments 
       FROM loan_request WHERE loan_id = ? LIMIT 1`,
      [loanId]
    );

    addAudit(req.user.email, `Loan request created ${loanId} for employee ${staffEmployeeId}`, 'Payroll');
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create loan request', error: err.message });
  }
});

// List loan requests — Staff sees own only, HR sees all
router.get("/loan-requests", authenticateToken, allowRoles("HR", "Staff"), async (req, res) => {
  try {
    let rows;
    if (req.user.role === "Staff") {
      // Resolve staff_employee_id from JWT userId
      const [staffRows] = await pool.query(
        'SELECT employee_id FROM staff WHERE user_user_id = ? LIMIT 1',
        [req.user.userId]
      );
      if (!staffRows.length) {
        return res.status(400).json({ message: "Staff profile not found for current user" });
      }
      const staffEmployeeId = staffRows[0].employee_id;

      [rows] = await pool.query(
        `SELECT 
          lr.loan_id,
          lr.staff_employee_id,
          s.name AS staff_name,
          lr.requested_amount,
          lr.repayment_months,
          lr.reason,
          lr.status,
          lr.monthly_installment,
          lr.outstanding_balance,
          lr.created_at,
          lr.hr_comments
        FROM loan_request lr
        JOIN staff s ON lr.staff_employee_id = s.employee_id
        WHERE lr.staff_employee_id = ?
        ORDER BY lr.created_at DESC`,
        [staffEmployeeId]
      );
    } else {
      // HR sees all loan requests
      [rows] = await pool.query(
        `SELECT 
          lr.loan_id,
          lr.staff_employee_id,
          s.name AS staff_name,
          lr.requested_amount,
          lr.repayment_months,
          lr.reason,
          lr.status,
          lr.monthly_installment,
          lr.outstanding_balance,
          lr.created_at,
          lr.hr_comments
        FROM loan_request lr
        JOIN staff s ON lr.staff_employee_id = s.employee_id
        ORDER BY lr.created_at DESC`
      );
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve loan requests', error: err.message });
  }
});

// Get single loan request with installments — Staff sees own only, HR sees any
router.get("/loan-requests/:id", authenticateToken, allowRoles("HR", "Staff"), async (req, res) => {
  try {
    // Fetch loan request by ID with staff name
    const [loanRows] = await pool.query(
      `SELECT 
        lr.loan_id,
        lr.staff_employee_id,
        s.name AS staff_name,
        lr.requested_amount,
        lr.repayment_months,
        lr.reason,
        lr.status,
        lr.monthly_installment,
        lr.total_paid,
        lr.outstanding_balance,
        lr.created_at,
        lr.created_by,
        lr.approved_by,
        lr.approved_at,
        lr.hr_comments
      FROM loan_request lr
      JOIN staff s ON lr.staff_employee_id = s.employee_id
      WHERE lr.loan_id = ?
      LIMIT 1`,
      [req.params.id]
    );

    if (!loanRows.length) {
      return res.status(404).json({ message: "Loan request not found" });
    }

    const loan = loanRows[0];

    // Staff: verify ownership
    if (req.user.role === "Staff") {
      const [staffRows] = await pool.query(
        'SELECT employee_id FROM staff WHERE user_user_id = ? LIMIT 1',
        [req.user.userId]
      );
      if (!staffRows.length) {
        return res.status(400).json({ message: "Staff profile not found for current user" });
      }
      const staffEmployeeId = staffRows[0].employee_id;
      if (loan.staff_employee_id !== staffEmployeeId) {
        return res.status(403).json({ message: "Not authorized to view this loan request" });
      }
    }

    // Fetch installments ordered by installment_number
    const [installments] = await pool.query(
      `SELECT 
        installment_id,
        loan_id,
        installment_number,
        amount,
        due_date,
        status,
        paid_at,
        paid_by
      FROM loan_installment
      WHERE loan_id = ?
      ORDER BY installment_number ASC`,
      [req.params.id]
    );

    res.json({ ...loan, installments });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve loan request', error: err.message });
  }
});

// Approve a loan request — only HR
router.put("/loan-requests/:id/approve", authenticateToken, allowRoles("HR"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const { hr_comments } = req.body || {};

    // Fetch the loan request
    const [loanRows] = await conn.query(
      `SELECT * FROM loan_request WHERE loan_id = ? LIMIT 1`,
      [id]
    );

    if (!loanRows.length) {
      conn.release();
      return res.status(404).json({ message: "Loan request not found" });
    }

    const loan = loanRows[0];

    // Validate pending status
    if (loan.status !== 'pending') {
      conn.release();
      return res.status(400).json({ message: `Cannot approve request in status ${loan.status}` });
    }

    await conn.beginTransaction();

    // Calculate monthly installment
    const amount = Number(loan.requested_amount);
    const months = Number(loan.repayment_months);
    const monthlyInstallment = Math.floor(amount / months * 100) / 100;
    const lastInstallment = Math.round((amount - (monthlyInstallment * (months - 1))) * 100) / 100;

    // Update loan_request to approved
    await conn.query(
      `UPDATE loan_request 
       SET status = 'approved', 
           approved_by = ?, 
           approved_at = NOW(), 
           hr_comments = ?, 
           monthly_installment = ?, 
           outstanding_balance = ?
       WHERE loan_id = ?`,
      [req.user.userId, hr_comments || null, monthlyInstallment, amount, id]
    );

    // Generate installments with batch INSERT
    const approvalDate = new Date();
    const installmentValues = [];
    for (let i = 1; i <= months; i++) {
      const installmentId = makeId('LI');
      const dueDate = new Date(approvalDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      const dueDateStr = dueDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const installmentAmount = (i === months) ? lastInstallment : monthlyInstallment;
      installmentValues.push([installmentId, id, i, installmentAmount, dueDateStr, 'unpaid']);
    }

    await conn.query(
      `INSERT INTO loan_installment (installment_id, loan_id, installment_number, amount, due_date, status) VALUES ?`,
      [installmentValues]
    );

    await conn.commit();

    // Fetch the updated loan with staff name
    const [updatedLoan] = await pool.query(
      `SELECT 
        lr.loan_id,
        lr.staff_employee_id,
        s.name AS staff_name,
        lr.requested_amount,
        lr.repayment_months,
        lr.reason,
        lr.status,
        lr.monthly_installment,
        lr.total_paid,
        lr.outstanding_balance,
        lr.created_at,
        lr.created_by,
        lr.approved_by,
        lr.approved_at,
        lr.hr_comments
      FROM loan_request lr
      JOIN staff s ON lr.staff_employee_id = s.employee_id
      WHERE lr.loan_id = ?
      LIMIT 1`,
      [id]
    );

    // Fetch generated installments
    const [installments] = await pool.query(
      `SELECT 
        installment_id,
        loan_id,
        installment_number,
        amount,
        due_date,
        status,
        paid_at,
        paid_by
      FROM loan_installment
      WHERE loan_id = ?
      ORDER BY installment_number ASC`,
      [id]
    );

    addAudit(req.user.email, `HR approved loan request ${id}`, 'Payroll');
    res.json({ ...updatedLoan[0], installments });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Failed to approve loan request', error: err.message });
  } finally {
    conn.release();
  }
});

// Reject a loan request — only HR
router.put("/loan-requests/:id/reject", authenticateToken, allowRoles("HR"), async (req, res) => {
  try {
    const { id } = req.params;
    const { hr_comments } = req.body || {};

    // Fetch the loan request
    const [loanRows] = await pool.query(
      `SELECT * FROM loan_request WHERE loan_id = ? LIMIT 1`,
      [id]
    );

    if (!loanRows.length) {
      return res.status(404).json({ message: "Loan request not found" });
    }

    const loan = loanRows[0];

    // Validate pending status
    if (loan.status !== 'pending') {
      return res.status(400).json({ message: `Cannot reject request in status ${loan.status}` });
    }

    // Update loan_request to rejected
    await pool.query(
      `UPDATE loan_request 
       SET status = 'rejected', 
           approved_by = ?, 
           approved_at = NOW(), 
           hr_comments = ?
       WHERE loan_id = ?`,
      [req.user.userId, hr_comments || null, id]
    );

    // Fetch the updated loan with staff name
    const [updatedLoan] = await pool.query(
      `SELECT 
        lr.loan_id,
        lr.staff_employee_id,
        s.name AS staff_name,
        lr.requested_amount,
        lr.repayment_months,
        lr.reason,
        lr.status,
        lr.monthly_installment,
        lr.total_paid,
        lr.outstanding_balance,
        lr.created_at,
        lr.created_by,
        lr.approved_by,
        lr.approved_at,
        lr.hr_comments
      FROM loan_request lr
      JOIN staff s ON lr.staff_employee_id = s.employee_id
      WHERE lr.loan_id = ?
      LIMIT 1`,
      [id]
    );

    addAudit(req.user.email, `HR rejected loan request ${id}`, 'Payroll');
    res.json(updatedLoan[0]);
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject loan request', error: err.message });
  }
});

// Mark an installment as paid — only HR
router.put("/loan-requests/:id/installments/:installmentId/pay", authenticateToken, allowRoles("HR"), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id, installmentId } = req.params;

    // Fetch the installment and validate it exists and belongs to this loan
    const [installmentRows] = await conn.query(
      `SELECT * FROM loan_installment WHERE installment_id = ? AND loan_id = ? LIMIT 1`,
      [installmentId, id]
    );

    if (!installmentRows.length) {
      conn.release();
      return res.status(404).json({ message: "Installment not found" });
    }

    const installment = installmentRows[0];

    // Validate installment is unpaid
    if (installment.status === 'paid') {
      conn.release();
      return res.status(400).json({ message: "Installment is already paid" });
    }

    await conn.beginTransaction();

    const installmentAmount = Number(installment.amount);

    // Update installment to paid
    await conn.query(
      `UPDATE loan_installment 
       SET status = 'paid', paid_at = NOW(), paid_by = ? 
       WHERE installment_id = ?`,
      [req.user.userId, installmentId]
    );

    // Update loan_request totals
    await conn.query(
      `UPDATE loan_request 
       SET total_paid = total_paid + ?, 
           outstanding_balance = outstanding_balance - ? 
       WHERE loan_id = ?`,
      [installmentAmount, installmentAmount, id]
    );

    await conn.commit();

    // Fetch updated installment
    const [updatedInstallment] = await pool.query(
      `SELECT installment_id, loan_id, installment_number, amount, due_date, status, paid_at, paid_by
       FROM loan_installment WHERE installment_id = ? LIMIT 1`,
      [installmentId]
    );

    // Fetch updated loan balance info
    const [updatedLoan] = await pool.query(
      `SELECT loan_id, total_paid, outstanding_balance FROM loan_request WHERE loan_id = ? LIMIT 1`,
      [id]
    );

    addAudit(req.user.email, `HR marked installment ${installmentId} as paid for loan ${id}`, 'Payroll');

    res.json({
      installment: updatedInstallment[0],
      loan: updatedLoan[0]
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: 'Failed to mark installment as paid', error: err.message });
  } finally {
    conn.release();
  }
});

router.get("/payslips/:id", authenticateToken, allowRoles("Admin", "HR", "Finance", "Staff"), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM payslip WHERE payslip_id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Payslip not found" });
    const payslip = rows[0];
    if (req.user.role === "Staff") {
      if (!payslip.staff_email || payslip.staff_email.toLowerCase() !== req.user.email.toLowerCase()) {
        return res.status(403).json({ message: "Not authorized to view this payslip" });
      }
      if (payslip.status !== 'sent_to_staff') {
        return res.status(400).json({ message: "Payslip not yet released to staff" });
      }
    }
    return res.json(payslip);
  } catch (err) {
    // fallback to memory
    const payslip = payslips.find((p) => p.payslip_id === req.params.id);
    if (!payslip) return res.status(404).json({ message: "Payslip not found" });
    return res.json(payslip);
  }
});

router.put("/payslips/:id/send-to-finance", authenticateToken, allowRoles("HR", "Admin"), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM payslip WHERE payslip_id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Payslip not found" });
    const payslip = rows[0];
    if (payslip.status !== 'draft') {
      return res.status(400).json({ message: "Only draft payslips can be sent to Finance" });
    }
    await pool.query('UPDATE payslip SET status = ?, updated_at = NOW() WHERE payslip_id = ?',
      ['finance_pending', req.params.id]);
    try {
      await pool.query('INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES (?, ?, ?, ?)',
        [`Sent payslip ${req.params.id} to Finance for approval`, 'HR', null, req.user.userId || null]);
    } catch(e) {}
    return res.json({ message: "Payslip sent to Finance for approval" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.put("/payslips/:id/send-to-staff", authenticateToken, allowRoles("HR", "Admin"), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM payslip WHERE payslip_id = ? LIMIT 1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Payslip not found" });
    const payslip = rows[0];
    if (payslip.status !== 'finance_approved') {
      return res.status(400).json({ message: "Payslip must be approved by Finance before sending to staff" });
    }
    await pool.query(
      'UPDATE payslip SET status = ?, sent_to_staff_at = NOW(), updated_at = NOW() WHERE payslip_id = ?',
      ['sent_to_staff', req.params.id]
    );
    try {
      await pool.query('INSERT INTO audit_log (action, entity_type, entity_id, user_user_id) VALUES (?, ?, ?, ?)',
        [`Sent payslip ${req.params.id} to staff`, 'HR', null, req.user.userId || null]);
    } catch(e) {}
    addAudit(req.user.email, `Sent payslip ${req.params.id} to staff`, "HR");
    return res.json({ message: "Payslip sent to staff successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});
router.get("/notifications", authenticateToken, allowRoles("HR", "Admin"), (_req, res) => {
  res.json([]);
});

router.get("/audit-log", authenticateToken, allowRoles("HR", "Admin"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT al.action, al.entity_type, al.created_at, u.name AS user_name
       FROM audit_log al
       LEFT JOIN user u ON al.user_user_id = u.user_id
       WHERE al.entity_type IN ('HR', 'Payroll', 'Staff')
       ORDER BY al.created_at DESC LIMIT 10`
    );
    return res.json(rows);
  } catch (err) {
    return res.json([]);
  }
});

module.exports = router;
