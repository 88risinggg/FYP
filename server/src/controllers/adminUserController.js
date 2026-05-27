const bcrypt = require("bcrypt");

const {
  createUser,
  findRoleById,
  findUserByEmail,
  findUserById,
  getRoles,
  listUsers,
  updateUser,
  updateUserPassword,
  updateUserStatus
} = require("../models/adminUserModel");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function normalizeName(name) {
  return String(name || "").trim();
}

function toStatus(value) {
  if (value === 0 || value === "0" || value === false) {
    return 0;
  }

  if (value === 1 || value === "1" || value === true) {
    return 1;
  }

  return null;
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
    statusLabel: Number(user.status) === 1 ? "Active" : "Disabled",
    roleId: user.roleId,
    roleName: user.roleName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLogin: null
  };
}

function buildSummary(users, roles) {
  const byRole = roles.reduce((summary, role) => {
    summary[role.roleName] = 0;
    return summary;
  }, {});

  users.forEach((user) => {
    byRole[user.roleName] = (byRole[user.roleName] || 0) + 1;
  });

  return {
    totalUsers: users.length,
    activeUsers: users.filter((user) => Number(user.status) === 1).length,
    disabledUsers: users.filter((user) => Number(user.status) === 0).length,
    roles: byRole
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
    const { search = "", roleId = "", status = "" } = req.query;
    const roles = await getRoles();
    const users = await listUsers({
      search: String(search).trim(),
      roleId: roleId ? Number(roleId) : null,
      status: String(status)
    });
    const allUsers = await listUsers({});

    res.json({
      users: users.map(formatUser),
      roles,
      summary: buildSummary(allUsers, roles)
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

    res.json({ user: formatUser(user) });
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
    const user = await createUser({ name, email, passwordHash, roleId, status });

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

    const user = await updateUser(userId, { name, email, roleId, status });

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
