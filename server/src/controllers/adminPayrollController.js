const bcrypt = require("bcrypt");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { getEffectivePayrollRules } = require("../services/payrollRuleConfigService");
const { generatePayslipPDF } = require("../services/payslipPdfService");
const { getCompany } = require("../services/companyService");
const { currentCompanyId } = require("../services/tenantContext");
const { getPublishedRuleState, getRuleAcknowledgement, publishPayrollRules, recordCurrentRulesPublication } = require("../services/payrollRuleGovernanceService");

const {
  createUserAccount,
  createPayslipLayout,
  getUserById,
  getDashboardStats,
  getAdminPayrollReportData,
  listAccountStatusInsight,
  listAdminActivityTrends,
  listAuditActivityInsight,
  listAuditLogs,
  listAvailableStaffForUserCreation,
  listMbmfEligibilitySummary,
  listPayrollRuns,
  listRunHealthInsight,
  listPayrollSettings,
  listPayslipLayouts,
  listUsers,
  listUserRoleInsight,
  listUsersWithRoles,
  setDefaultPayslipLayout,
  updateUserPassword,
  updateUserRole,
  updateUserStatus,
  upsertPayrollSetting
} = require("../models/adminPayrollModel");

const INSIGHT_DATASETS = new Set(["audit_activity", "user_roles", "account_status", "run_health"]);
const INSIGHT_ROLES = new Set(["all", "Admin", "Finance", "HR", "Staff"]);
const ACCOUNT_FILTERS = new Set(["all", "active", "pending", "disabled"]);
const GRANULARITIES = new Set(["day", "week", "month"]);

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && isoDate(date) === value ? date : null;
}

function normalizeInsightQuery(query = {}, now = new Date()) {
  const dataset = String(query.dataset || "audit_activity");
  if (!INSIGHT_DATASETS.has(dataset)) return { error: "Select a valid dashboard dataset." };
  const snapshot = ["user_roles", "account_status"].includes(dataset);
  const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const defaultFrom = new Date(defaultTo);
  if (dataset === "run_health") {
    defaultFrom.setUTCDate(1);
    defaultFrom.setUTCMonth(defaultFrom.getUTCMonth() - 5);
  } else {
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
  }
  const fromDate = snapshot ? null : (query.from ? validDate(query.from) : defaultFrom);
  const toDate = snapshot ? null : (query.to ? validDate(query.to) : defaultTo);
  if (!snapshot && (!fromDate || !toDate)) return { error: "Dates must use YYYY-MM-DD format." };
  if (!snapshot && fromDate > toDate) return { error: "The start date must not be after the end date." };
  const dayCount = snapshot ? 0 : Math.floor((toDate - fromDate) / 86400000) + 1;
  if (dayCount > 731) return { error: "Dashboard insight periods cannot exceed 731 days." };
  const requestedGranularity = String(query.granularity || "auto");
  if (requestedGranularity !== "auto" && !GRANULARITIES.has(requestedGranularity)) return { error: "Select a valid aggregation level." };
  const granularity = snapshot ? null : dataset === "run_health" ? "month" : requestedGranularity === "auto"
    ? (dayCount <= 31 ? "day" : dayCount <= 180 ? "week" : "month")
    : requestedGranularity;
  const role = String(query.role || "all");
  const accountStatus = String(query.accountStatus || "all").toLowerCase();
  if (!INSIGHT_ROLES.has(role)) return { error: "Select a valid payroll role." };
  if (!ACCOUNT_FILTERS.has(accountStatus)) return { error: "Select a valid account status." };
  return {
    dataset, snapshot, from: fromDate ? isoDate(fromDate) : null, to: toDate ? isoDate(toDate) : null,
    granularity, role, accountStatus
  };
}

function completeTimeBuckets(rows, filters, valueKey) {
  const byBucket = new Map(rows.map((row) => [String(row.bucket), row]));
  const cursor = new Date(`${filters.from}T00:00:00Z`);
  const end = new Date(`${filters.to}T00:00:00Z`);
  if (filters.granularity === "week") cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  if (filters.granularity === "month") cursor.setUTCDate(1);
  const output = [];
  while (cursor <= end) {
    const bucket = isoDate(cursor);
    output.push({ x: bucket, value: Number(byBucket.get(bucket)?.[valueKey] || 0) });
    if (filters.granularity === "day") cursor.setUTCDate(cursor.getUTCDate() + 1);
    else if (filters.granularity === "week") cursor.setUTCDate(cursor.getUTCDate() + 7);
    else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return output;
}

function completeRunBuckets(rows, filters) {
  const byBucket = new Map(rows.map((row) => [String(row.bucket), row]));
  const cursor = new Date(`${filters.from}T00:00:00Z`);
  cursor.setUTCDate(1);
  const end = new Date(`${filters.to}T00:00:00Z`);
  const output = [];
  while (cursor <= end) {
    const bucket = isoDate(cursor);
    output.push({ bucket, Completed: 0, "In Progress": 0, Delayed: 0, Failed: 0, ...(byBucket.get(bucket) || {}) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return output;
}

async function getAdminPayrollInsights(req, res) {
  const filters = normalizeInsightQuery(req.query);
  if (filters.error) return res.status(400).json({ message: filters.error });
  try {
    const asOf = new Date().toISOString();
    if (filters.dataset === "audit_activity") {
      const rows = await listAuditActivityInsight(filters);
      const data = completeTimeBuckets(rows, filters, "event_count");
      return res.json({ dataset: filters.dataset, chartType: "line", asOf, filters, totals: { events: data.reduce((sum, item) => sum + item.value, 0) }, series: [{ key: "events", label: "Audit events", color: "#4778dc", data }] });
    }
    if (filters.dataset === "user_roles") {
      const rows = await listUserRoleInsight(filters);
      const counts = new Map(rows.map((row) => [row.role_name, Number(row.user_count || 0)]));
      const data = ["Admin", "Finance", "HR", "Staff", "Unassigned"].map((role) => ({ x: role, value: counts.get(role) || 0 }));
      return res.json({ dataset: filters.dataset, chartType: "horizontal_bar", asOf, filters, totals: { users: data.reduce((sum, item) => sum + item.value, 0) }, series: [{ key: "users", label: "Users", color: "#7156b2", data }] });
    }
    if (filters.dataset === "account_status") {
      const colors = { Active: "#36855d", Pending: "#bd7b22", Disabled: "#d34b4b", Unlinked: "#68707a" };
      const rows = await listAccountStatusInsight(filters);
      const data = rows.map((row) => ({ x: row.status, value: Number(row.user_count || 0), color: colors[row.status] }));
      return res.json({ dataset: filters.dataset, chartType: "donut", asOf, filters, totals: { records: data.reduce((sum, item) => sum + item.value, 0) }, series: [{ key: "accounts", label: "Accounts", color: "#d65778", data }] });
    }
    const rows = completeRunBuckets(await listRunHealthInsight(filters), filters);
    const definitions = [
      ["completed", "Completed", "#36855d"], ["in_progress", "In Progress", "#7156b2"],
      ["delayed", "Delayed", "#bd7b22"], ["failed", "Failed", "#d34b4b"]
    ];
    const series = definitions.map(([key, label, color]) => ({ key, label, color, data: rows.map((row) => ({ x: row.bucket, value: Number(row[label] || 0) })) }));
    return res.json({ dataset: filters.dataset, chartType: "stacked_column", asOf, filters, totals: { runs: series.reduce((total, item) => total + item.data.reduce((sum, point) => sum + point.value, 0), 0) }, series });
  } catch (error) {
    console.error("Admin payroll insight error:", error.message);
    return res.status(500).json({ message: "Failed to load dashboard insight data." });
  }
}

async function getAdminPayrollReports(req, res) {
  try {
    res.json(await getAdminPayrollReportData());
  } catch (error) {
    console.error("Admin payroll report error:", error.message);
    res.status(500).json({ message: "Failed to load admin payroll reports." });
  }
}

const excelReportDefinitions = {
  "User Access & Account Status Report": { sheet: "User Access", headers: ["Employee", "Email", "Role", "Account Status", "Department", "Employee Code"], rows: (data) => (data.users || []).map((u) => [u.name, u.email, u.role_name, Number(u.status) === 1 ? "Active" : "Inactive", u.department_name || "No department", u.employee_code || "No linked staff"]) },
  "Statutory Configuration Report": { sheet: "Statutory Configuration", headers: ["Setting", "Configured Value", "Description"], rows: (data) => (data.settings || []).map((s) => [String(s.setting_key || "").replaceAll("_", " "), s.setting_value, s.description || "No description"]) },
  "Payroll Run Status & Exception Report": { sheet: "Payroll Runs", headers: ["Payroll Period", "Status", "Employees", "Created", "Updated", "Payment Reference"], rows: (data, from, to) => (data.payrollRuns || []).filter((r) => withinDateRange(r.created_at, from, to)).map((r) => [`${String(r.payroll_month).padStart(2, "0")}/${r.payroll_year}`, r.status || "Pending", Number(r.employee_count || 0), r.created_at, r.updated_at, r.payment_reference || ""]) },
  "Audit Activity Report": { sheet: "Audit Activity", headers: ["Date Time", "Action", "Record Area", "Module", "Actor", "Outcome"], rows: (data, from, to) => (data.auditLogs || []).filter((a) => withinDateRange(a.created_at, from, to)).map((a) => [a.created_at, a.action || "System activity", a.entity_type || "System", a.module || "System", a.user_name || "System", a.status || "Info"]) },
  "Effective Payroll Rules Report": { sheet: "Effective Rules", headers: ["Rule", "Category", "Current Value", "Usage", "Source", "Effective From", "Status", "Updated By"], rows: (data) => (data.effectiveRules?.rules || []).map((r) => [r.name, r.category, r.value, r.usage, r.source, r.effectiveFrom, r.status, r.updatedBy || "System default"]) }
};

function withinDateRange(value, from, to) {
  if (!from && !to) return true;
  const time = new Date(value || 0).getTime();
  const start = from ? new Date(`${from}T00:00:00+08:00`).getTime() : -Infinity;
  const end = to ? new Date(`${to}T23:59:59.999+08:00`).getTime() : Infinity;
  return Number.isFinite(time) && time >= start && time <= end;
}

async function exportAdminPayrollReport(req, res) {
  try {
    const reportType = String(req.query.reportType || "");
    const definition = excelReportDefinitions[reportType];
    if (!definition) return res.status(400).json({ message: "This report is not available as Excel." });
    const data = await getAdminPayrollReportData();
    const rows = definition.rows(data, req.query.from, req.query.to);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "PayNivo";
    const sheet = workbook.addWorksheet(definition.sheet, { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.addRow(definition.headers);
    rows.forEach((row) => sheet.addRow(row));
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF38978" } };
    sheet.columns.forEach((column, index) => { column.width = Math.min(42, Math.max(14, definition.headers[index].length + 3, ...rows.map((row) => String(row[index] ?? "").length + 2))); });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: definition.headers.length } };
    const fileName = `${reportType.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    return res.status(500).json({ message: "Failed to export the Admin payroll report." });
  }
}

async function getAdminEffectivePayrollRules(req, res) {
  try {
    const [catalogue, publication] = await Promise.all([getEffectivePayrollRules(), getPublishedRuleState()]);
    const acknowledgement = req.user?.role === "Finance" ? await getRuleAcknowledgement(req.user?.userId) : null;
    return res.json({ ...catalogue, publication, acknowledgement });
  } catch (error) {
    console.error("Effective payroll rules error:", error.message);
    return res.status(500).json({ message: "Failed to load effective payroll rules." });
  }
}

function normalizeFileType(fileType) {
  return String(fileType || "").trim().toUpperCase();
}

async function getAdminPayrollDashboard(req, res) {
  try {
    const [stats, layouts, settings, payrollRuns, auditLogs, auditTrends, roleSummary, users, mbmfEligibility, availableStaff, rulePublication] = await Promise.all([
      getDashboardStats(),
      listPayslipLayouts(),
      listPayrollSettings(),
      listPayrollRuns(),
      listAuditLogs(),
      listAdminActivityTrends(),
      listUsersWithRoles(),
      listUsers(),
      listMbmfEligibilitySummary(),
      listAvailableStaffForUserCreation(),
      getPublishedRuleState()
    ]);

    res.json({
      stats,
      layouts,
      settings,
      payrollRuns,
      auditLogs,
      auditTrends,
      roleSummary,
      users,
      mbmfEligibility,
      availableStaff,
      rulePublication
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load admin payroll dashboard."
    });
  }
}

async function getPayslipLayouts(req, res) {
  try {
    const layouts = await listPayslipLayouts();
    res.json({ layouts });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load payslip layouts."
    });
  }
}

async function getPayrollRuleConfig(req, res) {
  try {
    const [settings, mbmfEligibility] = await Promise.all([
      listPayrollSettings(),
      listMbmfEligibilitySummary()
    ]);

    res.json({
      settings,
      mbmfEligibility
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to load payroll rule config."
    });
  }
}

async function addPayslipLayout(req, res) {
  const uploadedFile = req.file;
  try {
    if (!uploadedFile) {
      return res.status(400).json({
        message: "Select a PDF payslip layout to upload."
      });
    }
    const descriptor = fs.openSync(uploadedFile.path, "r");
    const signature = Buffer.alloc(4);
    try {
      fs.readSync(descriptor, signature, 0, 4, 0);
    } finally {
      fs.closeSync(descriptor);
    }
    if (signature.toString() !== "%PDF") {
      fs.unlinkSync(uploadedFile.path);
      return res.status(400).json({
        message: "The selected file is not a valid PDF."
      });
    }

    const layoutName = String(req.body.layoutName || path.parse(uploadedFile.originalname).name).trim();
    const filePath = `/uploads/payslip-layouts/${uploadedFile.filename}`;

    const layoutId = await createPayslipLayout({
      layoutName,
      filePath,
      fileType: "PDF",
      originalFileName: uploadedFile.originalname,
      fileSize: uploadedFile.size,
      createdBy: req.user?.userId
    });
    const layouts = await listPayslipLayouts();

    res.status(201).json({
      layoutId,
      layouts
    });
  } catch (error) {
    if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
      fs.unlinkSync(uploadedFile.path);
    }
    console.error("Payslip layout upload error:", error.message);
    res.status(500).json({
      message: "Failed to add payslip layout."
    });
  }
}

async function makeDefaultPayslipLayout(req, res) {
  try {
    const layoutId = Number(req.params.layoutId);

    if (!Number.isInteger(layoutId) || layoutId <= 0) {
      return res.status(400).json({
        message: "Invalid payslip layout."
      });
    }

    const updated = await setDefaultPayslipLayout(layoutId);

    if (!updated) {
      return res.status(404).json({
        message: "Payslip layout not found."
      });
    }

    const layouts = await listPayslipLayouts();

    res.json({ layouts });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update default payslip layout."
    });
  }
}

async function previewPayslipLayout(req, res) {
  try {
    const layoutId = Number(req.params.layoutId);
    const layouts = await listPayslipLayouts();
    const layout = layouts.find((item) => Number(item.layout_id) === layoutId);
    if (!layout) return res.status(404).json({ message: "Payslip layout not found." });
    const uploadsRoot = path.resolve(__dirname, "..", "..", "uploads", "payslip-layouts");
    const fileName = path.basename(String(layout.file_path || ""));
    const filePath = path.resolve(uploadsRoot, fileName);
    if (!fileName || !filePath.startsWith(`${uploadsRoot}${path.sep}`) || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: "The stored payslip PDF is missing. Upload the layout again." });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${String(layout.original_file_name || "payslip-layout.pdf").replace(/[\r\n\"]/g, "")}"`);
    return res.sendFile(filePath);
  } catch (error) {
    return res.status(500).json({ message: "Unable to preview the payslip layout." });
  }
}

async function previewSamplePayslip(req, res) {
  try {
    const company = await getCompany(currentCompanyId());
    const pdf = await generatePayslipPDF({ employee_name: "Sample Employee", employee_id: "EMP-SAMPLE", employee_code: "EMP-0001", department_name: "Finance", work_location: "Singapore", employment_type: "Full-Time", working_days: 22, payroll_id: 1, payroll_month: new Date().getMonth() + 1, payroll_year: new Date().getFullYear(), basic_salary: 4200, gross_salary: 4400, total_allowances: 200, total_deductions: 855, net_salary: 3545, employee_cpf: 840, employer_cpf: 714, deduction_breakdown: { sdl: 11.25, selfHelpGroups: [{ fund: "Employee MBMF", amount: 15 }] }, company_name: company?.display_name, company_legal_name: company?.legal_name, company_registration_number: company?.registration_number, company_gst_number: company?.gst_number, company_email: company?.company_email, company_phone: company?.company_phone, company_address: company?.company_address, company_website: company?.company_website, company_logo_path: company?.logo_path, company_brand_color: company?.brand_color, company_currency: company?.currency, company_timezone: company?.timezone });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=sample-payslip.pdf");
    return res.send(pdf);
  } catch (error) {
    return res.status(500).json({ message: "Unable to generate the sample payslip preview." });
  }
}

function generateTemporaryPassword() {
  return `Paynivo-${crypto.randomBytes(4).toString("hex")}`;
}

async function refreshUserManagementPayload() {
  const [stats, roleSummary, users, auditLogs, availableStaff] = await Promise.all([
    getDashboardStats(),
    listUsersWithRoles(),
    listUsers(),
    listAuditLogs(),
    listAvailableStaffForUserCreation()
  ]);

  return {
    stats,
    roleSummary,
    users,
    auditLogs,
    availableStaff
  };
}

async function addUser(req, res) {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const name = String(req.body.name || "").trim();
    const roleId = Number(req.body.roleId);
    const status = Number(req.body.status ?? 1);
    const staffEmployeeId = req.body.staffEmployeeId ? Number(req.body.staffEmployeeId) : null;

    if (!email || !name || !Number.isInteger(roleId) || roleId <= 0 || ![0, 1].includes(status)) {
      return res.status(400).json({
        message: "Name, email, role and account status are required."
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        message: "Enter a valid email address."
      });
    }

    if (staffEmployeeId !== null && (!Number.isInteger(staffEmployeeId) || staffEmployeeId <= 0)) {
      return res.status(400).json({
        message: "Invalid staff record selected."
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const result = await createUserAccount({
      email,
      name,
      passwordHash,
      roleId,
      status,
      staffEmployeeId,
      adminUserId: req.user?.userId
    });

    if (result.duplicateEmail) {
      return res.status(409).json({
        message: "A user with this email already exists."
      });
    }

    if (result.invalidRole) {
      return res.status(400).json({
        message: "Selected role does not exist."
      });
    }

    if (result.invalidStaff) {
      return res.status(400).json({
        message: "Selected staff record does not exist."
      });
    }

    if (result.staffAlreadyLinked) {
      return res.status(409).json({
        message: "Selected staff record is already linked to a user."
      });
    }

    res.status(201).json({
      ...(await refreshUserManagementPayload()),
      temporaryPassword,
      userId: result.userId
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to add user."
    });
  }
}

async function changeUserStatus(req, res) {
  try {
    const userId = Number(req.params.userId);
    const status = Number(req.body.status);

    if (!Number.isInteger(userId) || userId <= 0 || ![0, 1].includes(status)) {
      return res.status(400).json({
        message: "Invalid user status update."
      });
    }

    if (userId === req.user?.userId && status === 0) {
      return res.status(400).json({
        message: "Admins cannot deactivate their own account."
      });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    await updateUserStatus({
      userId,
      status,
      adminUserId: req.user?.userId
    });

    res.json(await refreshUserManagementPayload());
  } catch (error) {
    res.status(500).json({
      message: "Failed to update user status."
    });
  }
}

async function changeUserRole(req, res) {
  try {
    const userId = Number(req.params.userId);
    const roleId = Number(req.body.roleId);

    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(roleId) || roleId <= 0) {
      return res.status(400).json({
        message: "Invalid role update."
      });
    }

    if (userId === req.user?.userId) {
      return res.status(400).json({
        message: "Admins cannot change their own role."
      });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    await updateUserRole({
      userId,
      roleId,
      adminUserId: req.user?.userId
    });

    res.json(await refreshUserManagementPayload());
  } catch (error) {
    res.status(500).json({
      message: "Failed to update user role."
    });
  }
}

async function resetUserPassword(req, res) {
  try {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({
        message: "Invalid user."
      });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    await updateUserPassword({
      userId,
      passwordHash,
      adminUserId: req.user?.userId
    });

    res.json({
      ...(await refreshUserManagementPayload()),
      temporaryPassword
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to reset user password."
    });
  }
}

async function updatePayrollSetting(req, res) {
  try {
    const settingKey = String(req.params.settingKey || "").trim();
    const settingValue = String(req.body.settingValue ?? "").trim();
    const description = String(req.body.description || "").trim();
    const effectiveFrom = req.body.effectiveFrom ? String(req.body.effectiveFrom).trim() : null;
    const ruleCategory = req.body.ruleCategory ? String(req.body.ruleCategory).trim() : null;
    const usageType = req.body.usageType ? String(req.body.usageType).trim().toLowerCase() : null;
    const isActive = req.body.isActive;

    if (!settingKey || !settingValue || !/^[a-z0-9_]+$/i.test(settingKey) || settingKey.length > 191) {
      return res.status(400).json({
        message: "A valid setting key and value are required."
      });
    }
    if (settingValue.length > 10000 || description.length > 500) {
      return res.status(400).json({ message: "Payroll setting value is too long." });
    }
    if (effectiveFrom && !validDate(effectiveFrom)) return res.status(400).json({ message: "Effective date must use YYYY-MM-DD format." });
    if (ruleCategory && ruleCategory.length > 80) return res.status(400).json({ message: "Rule category is too long." });
    if (usageType && !["calculation", "validation", "reference"].includes(usageType)) return res.status(400).json({ message: "Select a valid rule usage type." });
    if (/^cpf_rate_.*_(employee|employer)_percent$/.test(settingKey)) {
      const rate = Number(settingValue);
      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        return res.status(400).json({ message: "CPF rates must be between 0 and 100 percent." });
      }
    }
    if (settingKey === "cpf_monthly_wage_ceiling" && (!Number.isFinite(Number(settingValue)) || Number(settingValue) <= 0)) {
      return res.status(400).json({ message: "CPF monthly wage ceiling must be greater than zero." });
    }
    if (settingKey === "compliance_max_other_deduction_percent"
      && (!Number.isFinite(Number(settingValue)) || Number(settingValue) < 0 || Number(settingValue) > 100)) {
      return res.status(400).json({ message: "Maximum other deduction percentage must be between 0 and 100." });
    }

    await upsertPayrollSetting({
      settingKey,
      settingValue,
      description,
      effectiveFrom,
      ruleCategory,
      usageType,
      isActive,
      updatedBy: req.user?.userId,
      ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || null,
      deviceInfo: String(req.headers["user-agent"] || "").slice(0, 500) || null
    });
    await recordCurrentRulesPublication({ userId: req.user?.userId, changeReason: `Updated ${settingKey}`, changes: [{ settingKey, before: null, after: settingValue, effectiveFrom, referenceTitle: req.body.referenceTitle || null, referenceUrl: req.body.referenceUrl || null }] });

    const [stats, settings, auditLogs, mbmfEligibility] = await Promise.all([
      getDashboardStats(),
      listPayrollSettings(),
      listAuditLogs(),
      listMbmfEligibilitySummary()
    ]);

    res.json({
      stats,
      settings,
      auditLogs,
      mbmfEligibility
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update payroll setting."
    });
  }
}

async function publishPayrollRuleChanges(req, res) {
  try {
    const result = await publishPayrollRules({
      changes: req.body?.changes,
      changeReason: req.body?.changeReason,
      userId: req.user?.userId
    });
    const [stats, settings, auditLogs, mbmfEligibility] = await Promise.all([
      getDashboardStats(), listPayrollSettings(), listAuditLogs(), listMbmfEligibilitySummary()
    ]);
    return res.json({ ...result, stats, settings, auditLogs, mbmfEligibility });
  } catch (error) {
    const status = ["NO_RULE_CHANGES", "RULE_CHANGE_REASON_REQUIRED", "INVALID_RULE_CHANGE", "RULE_REFERENCE_REQUIRED", "INVALID_RULE_REFERENCE"].includes(error.code) ? 400 : 500;
    return res.status(status).json({ code: error.code || "RULE_PUBLICATION_FAILED", message: status === 500 ? "The payroll rule publication transaction failed and was rolled back." : error.message });
  }
}

module.exports = {
  addUser,
  addPayslipLayout,
  changeUserRole,
  changeUserStatus,
  getAdminPayrollDashboard,
  getAdminEffectivePayrollRules,
  getAdminPayrollInsights,
  getAdminPayrollReports,
  exportAdminPayrollReport,
  getPayrollRuleConfig,
  getPayslipLayouts,
  makeDefaultPayslipLayout,
  previewPayslipLayout,
  previewSamplePayslip,
  resetUserPassword,
  updatePayrollSetting,
  publishPayrollRuleChanges,
  normalizeInsightQuery
};
