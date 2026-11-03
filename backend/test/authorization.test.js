const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/auth");
const {
  ROLES,
  isSupportedRole,
  allowRoles,
  adminOnly,
  mainAdminOnly,
  ownerScope,
  canManageUser,
  canAssignUserRole,
} = require("../middleware/authorization");

const runMiddleware = async (middleware, user) => {
  let nextCalled = false;
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await middleware({ user }, response, () => {
    nextCalled = true;
  });
  return { response, nextCalled };
};

test("only supported roles pass role middleware", async () => {
  assert.deepEqual(ROLES, ["main_admin", "admin", "pharmacist"]);
  assert.equal(isSupportedRole("cashier"), false);
  assert.equal(isSupportedRole("owner"), false);

  for (const role of ROLES) {
    const result = await runMiddleware(allowRoles(role), { role });
    assert.equal(result.nextCalled, true);
    assert.equal(result.response.statusCode, 200);
  }

  const denied = await runMiddleware(adminOnly, { role: "pharmacist" });
  assert.equal(denied.nextCalled, false);
  assert.equal(denied.response.statusCode, 403);

  const adminDenied = await runMiddleware(mainAdminOnly, { role: "admin" });
  assert.equal(adminDenied.nextCalled, false);
  assert.equal(adminDenied.response.statusCode, 403);
});

test("pharmacist record scopes are owner-limited", () => {
  const pharmacist = { role: "pharmacist", _id: "staff-1" };
  assert.deepEqual(ownerScope(pharmacist, "servedBy"), { servedBy: "staff-1" });
  assert.deepEqual(ownerScope(pharmacist, "recordedBy"), { recordedBy: "staff-1" });
  assert.deepEqual(ownerScope({ role: "admin" }, "servedBy"), {});
  assert.deepEqual(ownerScope({ role: "main_admin" }, "processedBy"), {});
});

test("user management cannot grant or alter protected roles", () => {
  const mainAdmin = { role: "main_admin", _id: "root" };
  const admin = { role: "admin", _id: "admin-1" };
  const pharmacist = { role: "pharmacist", _id: "staff-1" };
  const otherAdmin = { role: "admin", _id: "admin-2" };
  const mainAdminAccount = { role: "main_admin", _id: "root" };

  assert.equal(canManageUser(admin, pharmacist), true);
  assert.equal(canManageUser(admin, admin), true);
  assert.equal(canManageUser(admin, otherAdmin), false);
  assert.equal(canManageUser(mainAdmin, otherAdmin), true);
  assert.equal(canManageUser(mainAdmin, mainAdminAccount), true);

  assert.equal(canAssignUserRole(admin, pharmacist, "pharmacist"), true);
  assert.equal(canAssignUserRole(admin, pharmacist, "admin"), false);
  assert.equal(canAssignUserRole(admin, admin, "pharmacist"), false);
  assert.equal(canAssignUserRole(mainAdmin, pharmacist, "admin"), true);
  assert.equal(canAssignUserRole(mainAdmin, admin, "pharmacist"), true);
  assert.equal(canAssignUserRole(mainAdmin, pharmacist, "main_admin"), false);
  assert.equal(canAssignUserRole(mainAdmin, mainAdminAccount, "admin"), false);
});

test("authentication rejects unsupported stored roles", async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFindById = User.findById;
  process.env.JWT_SECRET = "authorization-test-secret";
  const storedUser = {
    _id: "test-user",
    role: "unknown-role",
    status: "active",
    tokenVersion: 0,
    save: async () => {},
  };
  User.findById = () => ({ select: async () => storedUser });

  try {
    const token = jwt.sign({ id: storedUser._id, tokenVersion: 0 }, process.env.JWT_SECRET);
    const response = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    let nextCalled = false;

    await protect(
      { headers: { authorization: `Bearer ${token}` } },
      response,
      () => {
        nextCalled = true;
      },
    );

    assert.equal(nextCalled, false);
    assert.equal(response.statusCode, 403);
    assert.match(response.body.message, /unsupported role/i);
  } finally {
    User.findById = originalFindById;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test("legacy cashier role is normalized before authorization", async () => {
  const originalSecret = process.env.JWT_SECRET;
  const originalFindById = User.findById;
  process.env.JWT_SECRET = "authorization-test-secret";
  const storedUser = {
    _id: "legacy-user",
    role: "cashier",
    status: "active",
    tokenVersion: 0,
    save: async () => {},
  };
  User.findById = () => ({ select: async () => storedUser });

  try {
    const token = jwt.sign({ id: storedUser._id, tokenVersion: 0 }, process.env.JWT_SECRET);
    let nextCalled = false;
    const response = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };

    await protect(
      { headers: { authorization: `Bearer ${token}` } },
      response,
      () => {
        nextCalled = true;
      },
    );

    assert.equal(nextCalled, true);
    assert.equal(storedUser.role, "pharmacist");
  } finally {
    User.findById = originalFindById;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
