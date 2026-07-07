const {
  deactivateRole,
  duplicateRole,
  getRoleById,
  getRoleDistribution,
  getRoleOptions,
  getRolesSummary,
  listRoleActivity,
  listRoles
} = require("../models/adminRoleModel");
const { getClientIp, logAuditEvent } = require("../models/auditLogModel");

async function getRoles(req, res) {
  try {
    const { search = "", status = "", accessLevel = "", sort = "asc" } = req.query;
    const [roles, summary, activity, distribution, options] = await Promise.all([
      listRoles({
        search: String(search || "").trim(),
        status,
        accessLevel,
        sort
      }),
      getRolesSummary(),
      listRoleActivity({ limit: 5 }),
      getRoleDistribution(),
      getRoleOptions()
    ]);

    res.json({
      roles,
      summary,
      activity,
      distribution,
      options
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to load roles and permissions." });
  }
}

async function getRole(req, res) {
  try {
    const role = await getRoleById(req.params.id);

    if (!role) {
      return res.status(404).json({ message: "Role not found." });
    }

    const [activity, options] = await Promise.all([
      listRoleActivity({ limit: 8, roleId: req.params.id }),
      getRoleOptions()
    ]);

    res.json({ role, activity, options });
  } catch (error) {
    res.status(500).json({ message: "Unable to load role details." });
  }
}

async function getSummary(req, res) {
  try {
    res.json({ summary: await getRolesSummary() });
  } catch (error) {
    res.status(500).json({ message: "Unable to load role summary." });
  }
}

async function getActivity(req, res) {
  try {
    res.json({ activity: await listRoleActivity({ limit: 20 }) });
  } catch (error) {
    res.status(500).json({ message: "Unable to load role activity." });
  }
}

async function getDistribution(req, res) {
  try {
    res.json({ distribution: await getRoleDistribution() });
  } catch (error) {
    res.status(500).json({ message: "Unable to load role distribution." });
  }
}

async function postDuplicateRole(req, res) {
  try {
    const role = await duplicateRole(req.params.id);

    if (!role) {
      return res.status(404).json({ message: "Role not found." });
    }

    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Role Management",
      actionDescription: `Duplicate role requested for ${role.roleName}`,
      affectedRecord: String(role.roleId),
      status: "Success",
      ipAddress: getClientIp(req)
    });

    res.json({
      message: "Role duplicate request recorded.",
      role
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to duplicate role." });
  }
}

async function patchDeactivateRole(req, res) {
  try {
    const role = await deactivateRole(req.params.id);

    if (!role) {
      return res.status(404).json({ message: "Role not found." });
    }

    await logAuditEvent({
      userId: req.user?.userId,
      userName: req.user?.email || "Admin",
      activityType: "Role Management",
      actionDescription: `Deactivated role ${role.roleName}`,
      affectedRecord: String(role.roleId),
      status: "Success",
      ipAddress: getClientIp(req)
    });

    res.json({ role });
  } catch (error) {
    res.status(500).json({ message: "Unable to deactivate role." });
  }
}

module.exports = {
  getActivity,
  getDistribution,
  getRole,
  getRoles,
  getSummary,
  patchDeactivateRole,
  postDuplicateRole
};
