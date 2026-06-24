const bcrypt = require("bcrypt");
const crypto = require("crypto");

const {
  createUserAccount,
  createPayslipLayout,
  getUserById,
  getDashboardStats,
  listAuditLogs,
  listAvailableStaffForUserCreation,
  listMbmfEligibilitySummary,
  listPayrollRuns,
  listPayrollSettings,
  listPayslipLayouts,
  listUsers,
  listUsersWithRoles,
  setDefaultPayslipLayout,
  updateUserPassword,
  updateUserRole,
  updateUserStatus,
  upsertPayrollSetting
} = require("../models/adminPayrollModel");

function normalizeFileType(fileType) {
  return String(fileType || "").trim().toUpperCase();
}

async function getAdminPayrollDashboard(req, res) {
  try {
    const [stats, layouts, settings, payrollRuns, auditLogs, roleSummary, users, mbmfEligibility, availableStaff] = await Promise.all([
      getDashboardStats(),
      listPayslipLayouts(),
      listPayrollSettings(),
      listPayrollRuns(),
      listAuditLogs(),
      listUsersWithRoles(),
      listUsers(),
      listMbmfEligibilitySummary(),
      listAvailableStaffForUserCreation()
    ]);

    res.json({
      stats,
      layouts,
      settings,
      payrollRuns,
      auditLogs,
      roleSummary,
      users,
      mbmfEligibility,
      availableStaff
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
  try {
    const layoutName = String(req.body.layoutName || "").trim();
    const filePath = String(req.body.filePath || "").trim();
    const fileType = normalizeFileType(req.body.fileType);

    if (!layoutName || !filePath || !fileType) {
      return res.status(400).json({
        message: "Layout name, file path and file type are required."
      });
    }

    const allowedTypes = ["PDF", "HTML"];

    if (!allowedTypes.includes(fileType)) {
      return res.status(400).json({
        message: "File type must be PDF or HTML."
      });
    }

    const layoutId = await createPayslipLayout({
      layoutName,
      filePath,
      fileType,
      createdBy: req.user?.userId
    });
    const layouts = await listPayslipLayouts();

    res.status(201).json({
      layoutId,
      layouts
    });
  } catch (error) {
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

    if (!settingKey || !settingValue) {
      return res.status(400).json({
        message: "Setting key and value are required."
      });
    }

    await upsertPayrollSetting({
      settingKey,
      settingValue,
      description,
      updatedBy: req.user?.userId
    });

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

module.exports = {
  addUser,
  addPayslipLayout,
  changeUserRole,
  changeUserStatus,
  getAdminPayrollDashboard,
  getPayrollRuleConfig,
  getPayslipLayouts,
  makeDefaultPayslipLayout,
  resetUserPassword,
  updatePayrollSetting
};
