const bcrypt = require("bcrypt");

const {
  createUser,
  findRoleById,
  findUserByEmail,
  findUserById,
  getDepartments,
  getRoleDistribution,
  getRoles,
  getStatusOptions,
  getUserSummary,
  listUserActivity,
  listUsers,
  updateUser,
  updateUserPassword,
  updateUserStatus
} = require("../models/adminUserModel");
const { getClientIp, logAuditEvent } = require("../models/auditLogModel");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeName(name) {
  return String(name || "").trim();
}

function toStatus(value) {
  if (value === false) return 0;
  if (value === true) return 1;

  if (value !== undefined && value !== null && value !== "") {
    const status = Number(value);
    if (Number.isInteger(status) && status >= 0) {
      return status;
    }
  }

  return null;
}

function statusLabel(status) {
  const labels = {
    0: "Disabled",
    1: "Active",
    2: "Pending",
    3: "Inactive"
  };

  return labels[Number(status)] || `Status ${status}`;
}

function formatStatusOption(status) {
  return {
    value: Number(status),
    label: statusLabel(status)
  };
}

function formatUser(user) {
  if (!user) {
    return null;
  }

  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
    status: Number(user.status),
    statusLabel: statusLabel(user.status),
    roleId: user.roleId,
    roleName: user.roleName,
    departmentId: user.departmentId,
    departmentName: user.departmentName,
    permissions: user.roleDescription ? [user.roleDescription] : [],
    assignedModules: [],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLogin: user.lastLogin
  };
}

async function validateRole(roleId) {
  if (!roleId) {
    return null;
  }

  return findRoleById(Number(roleId));
}

async function getUsers(req, res) {
  try {
    const {
      search = "",
      roleId = "",
      departmentId = "",
      status = "",
      lastActiveFrom = "",
      page = "1",
      pageSize = "10"
    } = req.query;
    const [roles, departments, statusValues, result, summary, recentActivity, accessOverview] =
      await Promise.all([
        getRoles(),
        getDepartments(),
        getStatusOptions(),
        listUsers({
          search: String(search).trim(),
          roleId: roleId ? Number(roleId) : null,
          departmentId,
          status: status === "" ? "" : String(status),
          lastActiveFrom: String(lastActiveFrom || "").trim(),
          page: Number(page),
          pageSize: Number(pageSize)
        }),
        getUserSummary(),
        listUserActivity({ limit: 5 }),
        getRoleDistribution()
      ]);
    const totalPages = Math.max(Math.ceil(result.pagination.total / result.pagination.pageSize), 1);

    res.json({
      users: result.users.map(formatUser),
      roles,
      departments,
      statusOptions: statusValues.map(formatStatusOption),
      summary,
      recentActivity,
      accessOverview,
      pagination: {
        ...result.pagination,
        totalPages
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to load users." });
  }
}

async function getUser(req, res) {
  try {
    const user = await findUserById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const [roles, departments, statusValues, recentActivity] = await Promise.all([
      getRoles(),
      getDepartments(),
      getStatusOptions(),
      listUserActivity({ limit: 8, userId: req.params.id })
    ]);

    res.json({
      user: formatUser(user),
      roles,
      departments,
      statusOptions: statusValues.map(formatStatusOption),
      recentActivity
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to load user details." });
  }
}

async function postUser(req, res) {
  try {
    const name = normalizeName(req.body.name);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const roleId = Number(req.body.roleId);
    const status = toStatus(req.body.status);
    const departmentId = req.body.departmentId || null;

    if (!name) {
      return res.status(400).json({ message: "Name is required." });
    }

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    if (!emailPattern.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required when creating a user." });
    }

    const role = await validateRole(roleId);
    if (!role) {
      return res.status(400).json({ message: "Selected role does not exist." });
    }

    if (status === null) {
      return res.status(400).json({ message: "Selected status is invalid." });
    }

    const duplicate = await findUserByEmail(email);
    if (duplicate) {
      return res.status(409).json({ message: "A user with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ name, email, passwordHash, roleId, status, departmentId });

    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "User Management",
      actionDescription: `Created user account ${user.email}`,
      affectedRecord: String(user.userId),
      status: "Success",
      ipAddress: getClientIp(req)
    });

    res.status(201).json({ user: formatUser(user) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "A user with this email already exists." });
    }

    res.status(500).json({ message: "Unable to create user." });
  }
}

async function putUser(req, res) {
  try {
    const userId = Number(req.params.id);
    const currentUser = await findUserById(userId);

    if (!currentUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const name = normalizeName(req.body.name);
    const email = normalizeEmail(req.body.email);
    const roleId = Number(req.body.roleId);
    const status = toStatus(req.body.status);
    const departmentId = req.body.departmentId || null;

    if (!name) {
      return res.status(400).json({ message: "Name is required." });
    }

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    if (!emailPattern.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }

    const role = await validateRole(roleId);
    if (!role) {
      return res.status(400).json({ message: "Selected role does not exist." });
    }

    if (status === null) {
      return res.status(400).json({ message: "Selected status is invalid." });
    }

    const duplicate = await findUserByEmail(email);
    if (duplicate && Number(duplicate.userId) !== userId) {
      return res.status(409).json({ message: "A user with this email already exists." });
    }

    const user = await updateUser(userId, { name, email, roleId, status, departmentId });

    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "User Management",
      actionDescription: `Updated user account ${user.email}`,
      affectedRecord: String(user.userId),
      status: "Success",
      ipAddress: getClientIp(req)
    });

    res.json({ user: formatUser(user) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "A user with this email already exists." });
    }

    res.status(500).json({ message: "Unable to update user." });
  }
}

async function patchUserStatus(req, res) {
  try {
    const status = toStatus(req.body.status);

    if (status === null) {
      return res.status(400).json({ message: "Selected status is invalid." });
    }

    const currentUser = await findUserById(req.params.id);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = await updateUserStatus(req.params.id, status);

    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "User Management",
      actionDescription: `${status === 1 ? "Enabled" : "Disabled"} user account ${user.email}`,
      affectedRecord: String(user.userId),
      status: "Success",
      ipAddress: getClientIp(req)
    });

    res.json({ user: formatUser(user) });
  } catch (error) {
    res.status(500).json({ message: "Unable to update user status." });
  }
}

async function patchUserPassword(req, res) {
  try {
    const password = String(req.body.password || "");

    if (!password) {
      return res.status(400).json({ message: "New password is required." });
    }

    const currentUser = await findUserById(req.params.id);
    if (!currentUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await updateUserPassword(req.params.id, passwordHash);

    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "User Management",
      actionDescription: `Reset password for user account ${user.email}`,
      affectedRecord: String(user.userId),
      status: "Success",
      ipAddress: getClientIp(req)
    });

    res.json({
      message: "Password reset successfully.",
      user: formatUser(user)
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to reset password." });
  }
}

module.exports = {
  getUser,
  getUsers,
  patchUserPassword,
  patchUserStatus,
  postUser,
  putUser
};
