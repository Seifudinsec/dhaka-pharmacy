const ROLES = Object.freeze(["main_admin", "admin", "pharmacist"]);

const isSupportedRole = (role) => ROLES.includes(role);

const allowRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Your role is not permitted to perform this action.",
    });
  }
  next();
};

const adminOnly = allowRoles("admin", "main_admin");
const mainAdminOnly = allowRoles("main_admin");

const ownerScope = (user, field) =>
  user?.role === "pharmacist" ? { [field]: user._id } : {};

const canManageUser = (actor, target) => {
  const isSelf = String(actor?._id) === String(target?._id);
  if (actor?.role === "main_admin") {
    return target?.role !== "main_admin" || isSelf;
  }
  return actor?.role === "admin" && (target?.role === "pharmacist" || isSelf);
};

const canAssignUserRole = (actor, target, role) => {
  if (!ROLES.includes(role) || role === "main_admin" || target?.role === "main_admin") {
    return false;
  }
  return actor?.role === "main_admin" ||
    (actor?.role === "admin" && role === target?.role);
};

module.exports = {
  ROLES,
  isSupportedRole,
  allowRoles,
  adminOnly,
  mainAdminOnly,
  ownerScope,
  canManageUser,
  canAssignUserRole,
};
