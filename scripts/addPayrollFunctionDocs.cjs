/** Adds idempotent FUNCTION comments to meaningful Payroll Admin/Finance functions. */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const docs = {
  "client/src/pages/payroll/AdminPayrollPage.jsx": {
    LogoCropModal: "Lets Admin crop/position a company logo before persistent upload.",
    CompanyProfileView: "Loads and edits company identity, branding and the logo used by payroll documents.",
    DashboardView: "Presents Admin payroll governance totals, recent changes and quick actions.",
    AdminInsightsPanel: "Loads filterable audit, user-access and payroll-run health analytics.",
    EffectivePayrollRulesView: "Displays the active rule catalogue, sources, effective dates and publication status.",
    StaffManagementView: "Displays staff records available for payroll account/access administration.",
    UsersRolesView: "Manages payroll users, roles, statuses, permissions and activation requests.",
    BulkAccessModal: "Applies an access/status operation to multiple selected payroll users.",
    AddUserModal: "Collects and validates the details needed to create a linked payroll user.",
    UserManagementModal: "Updates one user's role/status or starts an Admin password reset.",
    PayslipLayoutsView: "Imports, previews and selects the default branded payslip layout.",
    CpfRateTable: "Edits employee/employer CPF percentage tiers used by payroll calculations.",
    WageComponentTable: "Configures which earning components are CPF-applicable.",
    DeductionComponentTable: "Configures which deductions reduce employee net pay.",
    EmployerContributionTable: "Configures employer-paid payroll contribution components.",
    MbmfContributionPanel: "Manages effective-dated MBMF wage bands, evidence and eligibility.",
    CpfCeilingPanel: "Manages the CPF monthly wage ceiling and its effective-date history.",
    SelfHelpGroupRulesPanel: "Configures MBMF, CDAC, SINDA and ECF eligibility/effective dates.",
    SettingsView: "Groups Admin payroll calculation settings into editable sections.",
    ComplianceRulesView: "Stages, validates and publishes statutory/validation rule changes.",
    CustomComplianceRulesPanel: "Creates and edits organisation-specific payroll compliance rules.",
    PayrollMonitorView: "Shows payroll-run status and responsible role without giving Admin approval power.",
    AuditLogsView: "Filters and displays traceable Payroll Admin actions.",
    PayslipsApprovalView: "Reviews payslips submitted for Admin approval or rejection.",
    ReportsView: "Previews and exports governance, access, rules and workflow reports.",
    AdminPayrollContent: "Loads Admin payroll data and routes the selected sidebar path to its feature view.",
    loadDashboard: "Refreshes Admin dashboard, settings, users, runs, layouts and audit information.",
    handleImportLayout: "Uploads a payslip layout and refreshes the layout list after success.",
    handleSetDefaultLayout: "Marks one payslip layout as the company default.",
    handleCreateUser: "Creates a payroll user and refreshes Admin user-management state.",
    handleUpdateUserStatus: "Activates or disables a payroll user through the protected API.",
    handleUpdateUserRole: "Changes a user's payroll role and refreshes permission information.",
    handleResetUserPassword: "Requests an Admin-controlled password reset and surfaces its result.",
    handleUpdatePayrollSetting: "Persists one Admin payroll setting and refreshes dependent dashboard data."
  },
  "server/src/controllers/adminPayrollController.js": {
    getAdminPayrollInsights: "Validates insight filters and returns Admin audit/access/run-health analytics.",
    getAdminPayrollReports: "Returns database-backed datasets available to Admin payroll reports.",
    exportAdminPayrollReport: "Builds and downloads the selected Admin payroll report.",
    getAdminEffectivePayrollRules: "Returns the effective rule catalogue plus publication/acknowledgement state.",
    getAdminPayrollDashboard: "Aggregates Admin statistics, users, settings, runs, layouts and audit records.",
    getPayslipLayouts: "Returns company payslip layouts and their default/preview metadata.",
    getPayrollRuleConfig: "Returns normalized active payroll calculation configuration.",
    addPayslipLayout: "Validates and stores an uploaded payslip template record.",
    makeDefaultPayslipLayout: "Selects one company payslip layout as the default.",
    previewPayslipLayout: "Generates a safe preview for a stored payslip layout.",
    previewSamplePayslip: "Generates a sample payslip preview using current branding/rules.",
    addUser: "Validates, creates and audits an Admin-managed payroll user account.",
    changeUserStatus: "Enables/disables a payroll account and returns refreshed user data.",
    changeUserRole: "Changes payroll role/permissions and records the Admin action.",
    resetUserPassword: "Creates a temporary password flow for an Admin-managed account.",
    updatePayrollSetting: "Validates and saves one configuration value with audit metadata.",
    publishPayrollRuleChanges: "Publishes a versioned rule batch and returns refreshed Admin data."
  },
  "server/src/models/adminPayrollModel.js": {
    getAdminPayrollReportData: "Loads database datasets used to build Admin governance reports.",
    getDashboardStats: "Calculates Admin dashboard totals for users, rules, runs and activity.",
    listPayslipLayouts: "Reads company payslip-template records from the database.",
    createPayslipLayout: "Inserts metadata for an uploaded payslip layout.",
    setDefaultPayslipLayout: "Atomically clears the old default and selects a new layout.",
    listPayrollSettings: "Returns current company payroll configuration rows.",
    listMbmfEligibilitySummary: "Summarises which staff records meet configured MBMF eligibility.",
    upsertPayrollSetting: "Inserts/updates a company payroll setting and records its audit evidence.",
    listPayrollRuns: "Returns payroll runs for Admin monitoring without approval mutation.",
    listAuditLogs: "Loads recent Payroll Admin audit events.",
    listAdminActivityTrends: "Aggregates recent Admin activity for dashboard trends.",
    listAuditActivityInsight: "Groups audit events into requested date buckets.",
    listUserRoleInsight: "Counts payroll users by role for access-governance reporting.",
    listAccountStatusInsight: "Counts active/inactive users, optionally filtered by role.",
    listRunHealthInsight: "Classifies payroll runs as healthy, attention-required or delayed.",
    listUsersWithRoles: "Returns payroll users with their assigned role/permission details.",
    listAvailableStaffForUserCreation: "Finds staff profiles not yet linked to a user account.",
    createUserAccount: "Creates and optionally links a company-scoped payroll user transactionally.",
    updateUserStatus: "Persists an Admin-authorised account status change.",
    updateUserRole: "Persists an Admin-authorised role change.",
    updateUserPassword: "Stores the new password hash for an Admin reset operation."
  },
  "client/src/pages/payroll/FinancePayrollPage.jsx": {
    DashboardView: "Summarises Finance workload, exceptions, funding, schedules and next action.",
    PayrollRunsView: "Guides review, employee approval, locking, payment and completion for a run.",
    CompliancePanel: "Displays run-level compliance checks and blocking explanations.",
    AuditTrailPanel: "Displays the selected run's ordered Finance activity evidence.",
    FinancePayrollJourney: "Visualises completed/current/upcoming stages for the selected run.",
    AccountingImpact: "Summarises payroll expense, liabilities and ledger impact.",
    CpfDeductionProcessPanel: "Tracks CPF and other deduction recording before ledger closure.",
    StaffPayrollDetailModal: "Lets Finance review/edit an employee before the run is locked.",
    FinancePayrollActivityView: "Loads searchable Finance payroll audit/activity records.",
    PayrollScheduleView: "Configures claim cut-off and salary-release dates and schedule actions.",
    PayslipsApprovalView: "Reviews payslip readiness/status within the Finance payroll area.",
    PayrollAdjustmentReview: "Shows legacy adjustment review data for the selected run.",
    ExplainablePayrollAdjustmentReview: "Generates and decides explainable safe adjustments/source blockers.",
    StaffPayrollDetailsView: "Coordinates staff review, status decisions, exceptions and recalculation.",
    NotificationRecordsView: "Displays payroll/payslip delivery events for the selected run.",
    PayrollReportsView: "Previews and exports Finance payroll, CPF, deduction and audit reports.",
    PayrollSummariesView: "Displays current and historical payroll totals by period.",
    FinanceStaffRecordsView: "Provides Finance a read-focused view of payroll-relevant staff data.",
    PayrollRunCompletionView: "Shows whether all accounting and reconciliation closure steps are complete.",
    PayrollRunHistoryView: "Lists completed/historical runs and opens their details.",
    GuidedWorkflowStageView: "Renders one enforced workflow stage with prerequisites and permitted action.",
    FinancePayrollContent: "Loads Finance payroll state and coordinates all feature routes/actions.",
    handleUpdateStaffStatus: "Persists one employee's Finance Approved/Hold decision.",
    handleSystemCheckApproveAll: "Approves eligible employees while holding exception records.",
    handleCreateDbRun: "Creates a real monthly run from database-backed staff data.",
    handleRecalculateRun: "Recalculates an unlocked run after policy/data corrections.",
    handleSaveRun: "Saves permitted pre-lock Finance edits.",
    handleGeneratePaymentFile: "Generates and records the run's payment preparation PDF.",
    handleSubmitModernTreasuryTransfer: "Starts/resumes retry-safe employee payment submission.",
    handleSetupModernTreasuryRecipients: "Creates/refreshes payment counterparties and receiving accounts.",
    handleAdvanceRun: "Maps a visible step to the authoritative backend workflow action."
  },
  "server/src/services/financePayrollScheduleService.js": {
    previousBusinessDate: "Moves a requested date backward around weekends/public holidays.",
    calculatePeriodSchedule: "Calculates effective claim cut-off and salary-release timestamps.",
    getFinanceScheduleConfig: "Loads the company's Finance payroll schedule configuration.",
    saveFinanceScheduleConfig: "Validates and persists company cut-off/release schedule settings.",
    previewFinanceSchedule: "Calculates a schedule preview without saving changes.",
    applyScheduleDefaultsToRun: "Copies calculated schedule dates onto an eligible payroll run.",
    updateRunSchedule: "Changes one unlocked run's cut-off/release timestamps.",
    confirmRunSchedule: "Validates and confirms an approved run for automatic release.",
    cancelRunSchedule: "Cancels an unreleased confirmed payroll schedule.",
    markRunForManualRetry: "Resets a failed unreleased schedule for another processing attempt.",
    claimTargetForApproval: "Chooses the payroll period that should receive an approved claim.",
    executeScheduledRelease: "Claims a due run, processes payment and records success/failure safely.",
    processDueScheduledReleases: "Finds due confirmed runs and processes a bounded batch."
  },
  "server/src/services/payrollRecoveryPostingService.js": {
    postPayrollRecoveries: "Posts paid payroll loan/advance deductions against outstanding balances once."
  },
  "server/src/workers/payrollReleaseScheduler.js": {
    startPayrollReleaseScheduler: "Starts the recurring background check for confirmed payroll releases."
  },
  "client/src/utils/financePayrollData.js": {
    normalizePayrollItem: "Normalizes a payroll line item into a safe label/rate/amount shape.",
    normalizeFinanceEmployee: "Normalizes backend employee payroll fields for Finance UI components.",
    normalizeFinancePayrollRun: "Normalizes one backend/demo run into the Finance page's canonical shape.",
    normalizeFinancePayrollRuns: "Normalizes a run collection and applies a safe fallback."
  },
  "client/src/utils/financePayrollNavigation.js": {
    shouldShowFinanceTracker: "Determines whether the workflow tracker belongs on the current Finance route.",
    getMissingScheduleFields: "Returns required schedule fields that Finance has not configured."
  },
  "client/src/utils/financePayrollWorkflow.js": {
    getFinanceWorkflowState: "Derives simple completed steps used by frontend buttons and trackers.",
    canAdvanceFinancePayrollRun: "Explains whether a requested Finance step may proceed.",
    getFinanceAutoAdvance: "Selects the next route after a successful workflow action."
  }
};

function addDocs(relativePath, functionDocs) {
  const absolutePath = path.join(root, relativePath);
  let lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);
  let additions = 0;
  for (const [name, description] of Object.entries(functionDocs)) {
    const declaration = new RegExp(`^(\\s*)(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(|^(\\s*)const\\s+${name}\\s*=`);
    const index = lines.findIndex((line) => declaration.test(line));
    if (index < 0) continue;
    const nearby = lines.slice(Math.max(0, index - 4), index).join("\n");
    if (/FUNCTION:/.test(nearby)) continue;
    const indent = (lines[index].match(/^\s*/) || [""])[0];
    lines.splice(index, 0, `${indent}// FUNCTION: ${description}`);
    additions += 1;
  }
  if (additions) fs.writeFileSync(absolutePath, lines.join("\n"), "utf8");
  return additions;
}

let total = 0;
for (const [file, functionDocs] of Object.entries(docs)) total += addDocs(file, functionDocs);
console.log(`Added ${total} Payroll Admin/Finance function explanations.`);
