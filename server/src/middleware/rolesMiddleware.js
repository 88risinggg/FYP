// [HR BRANCH - Steven] Added for HR role check — do not remove
function allowRoles(...allowed) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (allowed.includes(req.user.role)) return next();
    return res.status(403).json({ message: "Forbidden" });
  };
}

module.exports = {
  allowRoles
};
