// Reuse this for Admin, Finance, HR, Staff, and Customer route protection.
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: "You do not have permission to access this resource." });
    }

    return next();
  };
}
