import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  faUserPlus,
  faEdit,
  faTrash,
  faSearch,
  faKey,
  faUserShield,
  faUserClock,
  faToggleOn,
  faToggleOff,
  faChevronDown,
  faChevronUp,
} from "@fortawesome/free-solid-svg-icons";
import AppIcon from "../components/common/AppIcon";
import api from "../utils/api";
import toast from "react-hot-toast";
import useDebounce from "../hooks/useDebounce";
import {
  faCheckCircle,
  faCircleXmark,
} from "@fortawesome/free-solid-svg-icons";
import { SkeletonTable } from "../components/common/SkeletonLoaders";

const UsersManagementPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteAdminPassword, setDeleteAdminPassword] = useState("");
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    adminPassword: "",
    role: "pharmacist",
    notificationPreferences: {
      lowStock: true,
      expiry: true,
      dailySales: false,
    },
  });

  // State for the 2-step Add User Wizard
  const [addStep, setAddStep] = useState(0); // 0: Verify Admin, 1: New User Details

  // States for the 3-Step Password Reset Wizard
  const [resetStep, setResetStep] = useState(0); // 0: Verify Admin, 1: New Pass, 2: Final Confirm
  const [resetData, setResetData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [verifying, setVerifying] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState({
    loading: false,
    exists: false,
    checked: false,
  });
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const debouncedUsername = useDebounce(formData.username, 400);

  useEffect(() => {
    const checkUsername = async () => {
      if (!debouncedUsername || debouncedUsername.trim().length < 3) {
        setUsernameStatus({ loading: false, exists: false, checked: false });
        return;
      }

      // If we are editing, don't check if it's the current username
      if (
        selectedUser &&
        debouncedUsername.toLowerCase() === selectedUser.username.toLowerCase()
      ) {
        setUsernameStatus({ loading: false, exists: false, checked: true });
        return;
      }

      setUsernameStatus((prev) => ({ ...prev, loading: true }));
      try {
        const { data } = await api.get(`/users/check/${debouncedUsername}`);
        setUsernameStatus({
          loading: false,
          exists: data.exists,
          checked: true,
        });
      } catch {
        setUsernameStatus((prev) => ({ ...prev, loading: false }));
      }
    };

    if (showAddModal || showEditModal) {
      checkUsername();
    }
  }, [debouncedUsername, showAddModal, showEditModal, selectedUser]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get("/users");
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/users", formData);
      if (data.success) {
        toast.success("User created successfully");
        setShowAddModal(false);
        setAddStep(0);
        setFormData({
          username: "",
          password: "",
          adminPassword: "",
          role: "pharmacist",
          notificationPreferences: {
            lowStock: true,
            expiry: true,
            dailySales: false,
          },
        });
        fetchUsers();
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(error.response?.data?.message || "Failed to create user");
    }
  };

  const handleVerifyBeforeAdd = async (e) => {
    e.preventDefault();
    setVerifying(true);
    try {
      const { data } = await api.post("/users/verify-password", {
        password: formData.adminPassword,
      });
      if (data.success) {
        setAddStep(1);
        toast.success("Identity verified. You may now enter new user details.");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Verification failed. Please check your password.",
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put(`/users/${selectedUser._id}`, formData);
      if (data.success) {
        toast.success("User updated successfully");
        setShowEditModal(false);
        setSelectedUser(null);
        fetchUsers();
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(error.response?.data?.message || "Failed to update user");
    }
  };

  const handleVerifyCurrentPassword = async (e) => {
    e.preventDefault();
    setVerifying(true);
    try {
      const { data } = await api.post("/users/verify-password", {
        password: resetData.currentPassword,
      });
      if (data.success) {
        setResetStep(1);
        toast.success("Identity verified. You may now enter a new password.");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Verification failed. Please check your password.",
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(
        `/users/${selectedUser._id}/reset-password`,
        {
          newPassword: resetData.newPassword,
          confirmPassword: resetData.currentPassword,
        },
      );
      if (data.success) {
        toast.success("Password reset successfully");
        setShowResetPasswordModal(false);
        setSelectedUser(null);
        setResetData({
          currentPassword: "",
          newPassword: "",
          confirmNewPassword: "",
        });
        setResetStep(0);
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      toast.error(error.response?.data?.message || "Failed to reset password");
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    setActionLoading((prev) => ({ ...prev, [`toggle_${userId}`]: true }));
    try {
      const { data } = await api.put(`/users/${userId}/toggle-status`, {
        status: currentStatus === "active" ? "inactive" : "active",
      });
      if (data.success) {
        toast.success(
          `User ${currentStatus === "active" ? "deactivated" : "activated"} successfully`,
        );
        fetchUsers();
      }
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error(
        error.response?.data?.message || "Failed to update user status",
      );
    } finally {
      setActionLoading((prev) => ({ ...prev, [`toggle_${userId}`]: false }));
    }
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteAdminPassword("");
  };

  const handleDeleteUser = async (e) => {
    e.preventDefault();
    if (!deleteTarget) {
      return;
    }
    const userId = deleteTarget._id;
    setActionLoading((prev) => ({ ...prev, [`delete_${userId}`]: true }));
    try {
      const { data } = await api.delete(`/users/${userId}`, {
        data: { adminPassword: deleteAdminPassword },
      });
      if (data.success) {
        toast.success("User deleted successfully");
        closeDeleteModal();
        setExpandedUserId((prev) => (prev === userId ? null : prev));
        fetchUsers();
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error(error.response?.data?.message || "Failed to delete user");
    } finally {
      setActionLoading((prev) => ({ ...prev, [`delete_${userId}`]: false }));
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: "",
      role: user.role,
      notificationPreferences: user.notificationPreferences,
    });
    setShowEditModal(true);
  };

  const openResetPasswordModal = (user) => {
    setSelectedUser(user);
    setResetData({
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    });
    setResetStep(0);
    setShowResetPasswordModal(true);
  };

  const openDeleteModal = (user) => {
    setDeleteTarget(user);
    setDeleteAdminPassword("");
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="users-management-page">
        <div className="page-header-actions">
          <div className="search-bar">
            <AppIcon icon={faSearch} className="search-icon" />
            <input
              type="text"
              placeholder="Search users..."
              className="form-input"
              disabled
            />
          </div>
          <button className="btn btn-primary" disabled>
            <AppIcon icon={faUserPlus} className="btn-icon" />
            Add User
          </button>
        </div>
        <div className="users-table-container">
          <div className="loader-fade-in">
            <SkeletonTable rows={6} cols={7} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="users-management-page">
      <div className="page-header-actions">
        <div className="search-bar">
          <AppIcon icon={faSearch} className="search-icon" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
          />
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setAddStep(0);
            setFormData({
              username: "",
              password: "",
              adminPassword: "",
              role: "pharmacist",
              notificationPreferences: {
                lowStock: true,
                expiry: true,
                dailySales: false,
              },
            });
            setShowAddModal(true);
          }}
        >
          <AppIcon icon={faUserPlus} className="btn-icon" />
          Add User
        </button>
      </div>

      <div className="users-table-container">
        <div className="table-wrap table-responsive-cards users-desktop-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Notifications</th>
                <th>Last Active</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user._id}>
                  <td data-label="User">
                    <div className="user-cell">
                      <div className="user-avatar">
                        {user.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="user-name">{user.username}</div>
                        <div className="user-role-badge">{user.role}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Role">
                    <span className={`role-badge ${user.role === 'Main Admin' ? 'admin' : user.role === 'Admin' ? 'admin' : 'pharmacist'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td data-label="Status">
                    <button
                      className="status-toggle"
                      onClick={() =>
                        handleToggleUserStatus(user._id, user.status)
                      }
                      disabled={actionLoading[`toggle_${user._id}`]}
                      title={`Click to ${user.status === "active" ? "deactivate" : "activate"}`}
                    >
                      {actionLoading[`toggle_${user._id}`] ? (
                        <span
                          className="spinner spinner-sm"
                          aria-hidden="true"
                        />
                      ) : (
                        <AppIcon
                          icon={
                            user.status === "active" ? faToggleOn : faToggleOff
                          }
                          className={
                            user.status === "active" ? "active" : "inactive"
                          }
                        />
                      )}
                      {user.status}
                    </button>
                  </td>
                  <td data-label="Notifications">
                    <div className="notification-preferences">
                      <span
                        title="Low Stock"
                        className={
                          user.notificationPreferences.lowStock
                            ? "enabled"
                            : "disabled"
                        }
                      >
                        Stock
                      </span>
                      <span
                        title="Expiry"
                        className={
                          user.notificationPreferences.expiry
                            ? "enabled"
                            : "disabled"
                        }
                      >
                        Expiry
                      </span>
                      <span
                        title="Daily Sales"
                        className={
                          user.notificationPreferences.dailySales
                            ? "enabled"
                            : "disabled"
                        }
                      >
                        Sales
                      </span>
                    </div>
                  </td>
                  <td data-label="Last Active">
                    {user.lastActive
                      ? format(new Date(user.lastActive), "MMM dd, yyyy")
                      : "Never"}
                  </td>
                  <td data-label="Created">
                    {format(new Date(user.createdAt), "MMM dd, yyyy")}
                  </td>
                  <td data-label="Actions">
                    <div className="action-buttons">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openEditModal(user)}
                        title="Edit user"
                      >
                        <AppIcon icon={faEdit} />
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openResetPasswordModal(user)}
                        title="Reset password"
                      >
                        <AppIcon icon={faKey} />
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => openDeleteModal(user)}
                        disabled={actionLoading[`delete_${user._id}`]}
                        title="Delete user"
                      >
                        {actionLoading[`delete_${user._id}`] ? (
                          <span
                            className="spinner spinner-sm"
                            aria-hidden="true"
                          />
                        ) : (
                          <AppIcon icon={faTrash} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="users-mobile-list">
          {filteredUsers.map((user) => {
            const isExpanded = expandedUserId === user._id;
            return (
              <div key={user._id} className="user-mobile-card">
                <button
                  type="button"
                  className="user-mobile-card-header"
                  onClick={() =>
                    setExpandedUserId(isExpanded ? null : user._id)
                  }
                >
                  <div className="user-cell">
                    <div className="user-avatar">
                      {user.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="user-name">{user.username}</div>
                      <div
                        className="user-role-badge"
                        style={{ display: "inline-block" }}
                      >
                        {user.role}
                      </div>
                    </div>
                  </div>
                  <AppIcon icon={isExpanded ? faChevronUp : faChevronDown} />
                </button>

                {isExpanded && (
                  <div className="user-mobile-card-body">
                    <div className="user-mobile-row">
                      <span className="user-mobile-label">Role</span>
                      <span className={`role-badge ${user.role === 'Main Admin' ? 'admin' : user.role === 'Admin' ? 'admin' : 'pharmacist'}`}>
                        {user.role}
                      </span>
                    </div>

                    <div className="user-mobile-row">
                      <span className="user-mobile-label">Status</span>
                      <button
                        className="status-toggle"
                        onClick={() =>
                          handleToggleUserStatus(user._id, user.status)
                        }
                        disabled={actionLoading[`toggle_${user._id}`]}
                        title={`Click to ${user.status === "active" ? "deactivate" : "activate"}`}
                      >
                        {actionLoading[`toggle_${user._id}`] ? (
                          <span
                            className="spinner spinner-sm"
                            aria-hidden="true"
                          />
                        ) : (
                          <AppIcon
                            icon={
                              user.status === "active"
                                ? faToggleOn
                                : faToggleOff
                            }
                            className={
                              user.status === "active" ? "active" : "inactive"
                            }
                          />
                        )}
                        {user.status}
                      </button>
                    </div>

                    <div className="user-mobile-row">
                      <span className="user-mobile-label">Notifications</span>
                      <div className="notification-preferences">
                        <span
                          title="Low Stock"
                          className={
                            user.notificationPreferences.lowStock
                              ? "enabled"
                              : "disabled"
                          }
                        >
                          Stock
                        </span>
                        <span
                          title="Expiry"
                          className={
                            user.notificationPreferences.expiry
                              ? "enabled"
                              : "disabled"
                          }
                        >
                          Expiry
                        </span>
                        <span
                          title="Daily Sales"
                          className={
                            user.notificationPreferences.dailySales
                              ? "enabled"
                              : "disabled"
                          }
                        >
                          Sales
                        </span>
                      </div>
                    </div>

                    <div className="user-mobile-row">
                      <span className="user-mobile-label">Last Active</span>
                      <span>
                        {user.lastActive
                          ? format(new Date(user.lastActive), "MMM dd, yyyy")
                          : "Never"}
                      </span>
                    </div>

                    <div className="user-mobile-row">
                      <span className="user-mobile-label">Created</span>
                      <span>
                        {format(new Date(user.createdAt), "MMM dd, yyyy")}
                      </span>
                    </div>

                    <div className="user-mobile-actions">
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openEditModal(user)}
                        title="Edit user"
                      >
                        <AppIcon icon={faEdit} /> Edit
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => openResetPasswordModal(user)}
                        title="Reset password"
                      >
                        <AppIcon icon={faKey} /> Reset
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => openDeleteModal(user)}
                        disabled={actionLoading[`delete_${user._id}`]}
                        title="Delete user"
                      >
                        {actionLoading[`delete_${user._id}`] ? (
                          <span
                            className="spinner spinner-sm"
                            aria-hidden="true"
                          />
                        ) : (
                          <AppIcon icon={faTrash} />
                        )}{" "}
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowAddModal(false);
            setAddStep(0);
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New User</h2>
              <button
                className="modal-close"
                onClick={() => {
                  setShowAddModal(false);
                  setAddStep(0);
                }}
              >
                ×
              </button>
            </div>
            {addStep === 0 ? (
              <form onSubmit={handleVerifyBeforeAdd} className="modal-body">
                <div
                  style={{
                    padding: "12px",
                    background: "var(--blue-50)",
                    border: "1px solid var(--blue-200)",
                    borderRadius: "6px",
                    marginBottom: "16px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "var(--blue-800)",
                    }}
                  >
                    <strong>Security Check:</strong> Please verify your admin
                    password before adding a new user.
                  </p>
                </div>
                <div className="form-group">
                  <label htmlFor="add-admin-password">
                    Your Admin Password
                  </label>
                  <input
                    id="add-admin-password"
                    type="password"
                    required
                    autoFocus
                    placeholder="Enter your current password"
                    value={formData.adminPassword || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        adminPassword: e.target.value,
                      })
                    }
                    className="form-input"
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowAddModal(false);
                      setAddStep(0);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={verifying || !formData.adminPassword}
                  >
                    {verifying ? "Verifying..." : "Verify to Proceed"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddUser} className="modal-body">
                <div className="form-group">
                  <label htmlFor="add-username">Username</label>
                  <input
                    id="add-username"
                    type="text"
                    required
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="form-input"
                  />
                  {usernameStatus.checked && formData.username.length >= 3 && (
                    <div
                      className={`input-feedback ${usernameStatus.exists ? "error" : "success"}`}
                      style={{
                        fontSize: "11px",
                        marginTop: "4px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        color: usernameStatus.exists
                          ? "var(--red-600)"
                          : "var(--green-600)",
                      }}
                    >
                      <AppIcon
                        icon={
                          usernameStatus.exists ? faCircleXmark : faCheckCircle
                        }
                        size="xs"
                      />
                      {usernameStatus.exists
                        ? "Username already taken"
                        : "Username available"}
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="add-password">User's Password</label>
                  <input
                    id="add-password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="add-role">Role</label>
                  <select
                    id="add-role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className="form-select"
                  >
                    <option value="pharmacist">Pharmacist</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Notification Preferences</label>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.notificationPreferences.lowStock}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            notificationPreferences: {
                              ...formData.notificationPreferences,
                              lowStock: e.target.checked,
                            },
                          })
                        }
                      />
                      Low Stock Alerts
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.notificationPreferences.expiry}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            notificationPreferences: {
                              ...formData.notificationPreferences,
                              expiry: e.target.checked,
                            },
                          })
                        }
                      />
                      Expiry Alerts
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.notificationPreferences.dailySales}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            notificationPreferences: {
                              ...formData.notificationPreferences,
                              dailySales: e.target.checked,
                            },
                          })
                        }
                      />
                      Daily Sales Summary
                    </label>
                  </div>
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setAddStep(0);
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={
                      usernameStatus.exists || formData.username.length < 3
                    }
                  >
                    Add User
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete User</h2>
              <button className="modal-close" onClick={closeDeleteModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleDeleteUser}>
              <div className="modal-body">
                <div
                  style={{
                    padding: "12px",
                    background: "var(--warning-50)",
                    border: "1px solid var(--warning-200)",
                    borderRadius: "6px",
                    marginBottom: "16px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "var(--warning-700)",
                    }}
                  >
                    <strong>Security Check:</strong> Verify your admin password
                    to permanently delete{" "}
                    <strong>{deleteTarget.username}</strong>.
                  </p>
                </div>
                <div className="form-group">
                  <label htmlFor="delete-admin-password">
                    Your Admin Password
                  </label>
                  <input
                    id="delete-admin-password"
                    type="password"
                    required
                    autoFocus
                    placeholder="Enter your current password"
                    value={deleteAdminPassword}
                    onChange={(e) => setDeleteAdminPassword(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeDeleteModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={
                    actionLoading[`delete_${deleteTarget._id}`] ||
                    !deleteAdminPassword
                  }
                >
                  {actionLoading[`delete_${deleteTarget._id}`]
                    ? "Deleting..."
                    : "Verify & Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit User</h2>
              <button
                className="modal-close"
                onClick={() => setShowEditModal(false)}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleEditUser} className="modal-body">
              <div className="form-group">
                <label htmlFor="edit-username">Username</label>
                <input
                  id="edit-username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  className="form-input"
                />
                {usernameStatus.checked && formData.username.length >= 3 && (
                  <div
                    className={`input-feedback ${usernameStatus.exists ? "error" : "success"}`}
                    style={{
                      fontSize: "11px",
                      marginTop: "4px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      color: usernameStatus.exists
                        ? "var(--red-600)"
                        : "var(--green-600)",
                    }}
                  >
                    <AppIcon
                      icon={
                        usernameStatus.exists ? faCircleXmark : faCheckCircle
                      }
                      size="xs"
                    />
                    {usernameStatus.exists
                      ? "Username already taken"
                      : "Username available"}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="edit-role">Role</label>
                <select
                  id="edit-role"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({ ...formData, role: e.target.value })
                  }
                  className="form-select"
                >
                  <option value="pharmacist">Pharmacist</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notification Preferences</label>
                <div className="checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.notificationPreferences.lowStock}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          notificationPreferences: {
                            ...formData.notificationPreferences,
                            lowStock: e.target.checked,
                          },
                        })
                      }
                    />
                    Low Stock Alerts
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.notificationPreferences.expiry}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          notificationPreferences: {
                            ...formData.notificationPreferences,
                            expiry: e.target.checked,
                          },
                        })
                      }
                    />
                    Expiry Alerts
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.notificationPreferences.dailySales}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          notificationPreferences: {
                            ...formData.notificationPreferences,
                            dailySales: e.target.checked,
                          },
                        })
                      }
                    />
                    Daily Sales Summary
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    usernameStatus.exists || formData.username.length < 3
                  }
                >
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .users-mobile-list { display: none; }
        .user-mobile-card {
          border: 1px solid var(--gray-200);
          border-radius: var(--radius-md);
          margin-bottom: 10px;
          background: var(--white);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
        .user-mobile-card-header {
          width: 100%;
          background: transparent;
          border: none;
          padding: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          text-align: left;
        }
        .user-mobile-card-body {
          border-top: 1px solid var(--gray-100);
          padding: 12px;
          display: grid;
          gap: 10px;
        }
        .user-mobile-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          font-size: 13px;
        }
        .user-mobile-label {
          font-weight: 700;
          color: var(--gray-600);
        }
        .user-mobile-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 4px;
        }
        @media (max-width: 768px) {
          .users-desktop-table { display: none; }
          .users-mobile-list { display: block; }
        }
      `}</style>

      {/* 3-Step Secure Reset Password Modal */}
      {showResetPasswordModal && selectedUser && (
        <div
          className="modal-overlay"
          onClick={() => setShowResetPasswordModal(false)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "450px" }}
          >
            <div className="modal-header">
              <div style={{ display: "flex", flexDirection: "column" }}>
                <h2 style={{ marginBottom: "4px" }}>Secure Password Reset</h2>
                <div
                  className="step-indicator"
                  style={{ display: "flex", gap: "8px" }}
                >
                  {[0, 1, 2].map((s) => (
                    <div
                      key={s}
                      style={{
                        height: "4px",
                        flex: 1,
                        borderRadius: "2px",
                        background:
                          resetStep >= s
                            ? "var(--blue-600)"
                            : "var(--slate-200)",
                      }}
                    />
                  ))}
                </div>
              </div>
              <button
                className="modal-close"
                onClick={() => setShowResetPasswordModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--slate-50)",
                  borderRadius: "6px",
                  marginBottom: "20px",
                  border: "1px solid var(--slate-100)",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "var(--slate-500)",
                  }}
                >
                  Target Account
                </p>
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--slate-900)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <AppIcon icon={faKey} size="sm" /> {selectedUser.username}
                </div>
              </div>

              {resetStep === 0 && (
                <form onSubmit={handleVerifyCurrentPassword}>
                  <div className="form-group">
                    <label htmlFor="verify-password">
                      Confirm Your Identity
                    </label>
                    <p
                      style={{
                        fontSize: "13px",
                        color: "var(--slate-600)",
                        marginBottom: "12px",
                      }}
                    >
                      To begin, please enter **YOUR** current administrator
                      password.
                    </p>
                    <input
                      id="verify-password"
                      type="password"
                      required
                      autoFocus
                      placeholder="Your current password"
                      value={resetData.currentPassword}
                      onChange={(e) =>
                        setResetData({
                          ...resetData,
                          currentPassword: e.target.value,
                        })
                      }
                      className="form-input"
                    />
                  </div>
                  <div className="modal-actions" style={{ marginTop: "24px" }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setShowResetPasswordModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={verifying || !resetData.currentPassword}
                    >
                      {verifying ? "Verifying..." : "Next Step"}
                    </button>
                  </div>
                </form>
              )}

              {resetStep === 1 && (
                <div>
                  <div className="form-group">
                    <label htmlFor="new-password">New Password</label>
                    <input
                      id="new-password"
                      type="password"
                      required
                      autoFocus
                      placeholder="Min 6 characters"
                      value={resetData.newPassword}
                      onChange={(e) =>
                        setResetData({
                          ...resetData,
                          newPassword: e.target.value,
                        })
                      }
                      className="form-input"
                    />
                  </div>
                  <div className="form-group" style={{ marginTop: "12px" }}>
                    <label htmlFor="confirm-new-password">
                      Confirm New Password
                    </label>
                    <input
                      id="confirm-new-password"
                      type="password"
                      required
                      placeholder="Repeat new password"
                      value={resetData.confirmNewPassword}
                      onChange={(e) =>
                        setResetData({
                          ...resetData,
                          confirmNewPassword: e.target.value,
                        })
                      }
                      className="form-input"
                    />
                    {resetData.newPassword &&
                      resetData.confirmNewPassword &&
                      resetData.newPassword !==
                        resetData.confirmNewPassword && (
                        <p
                          style={{
                            color: "var(--red-600)",
                            fontSize: "11px",
                            marginTop: "4px",
                          }}
                        >
                          Passwords do not match.
                        </p>
                      )}
                  </div>
                  <div className="modal-actions" style={{ marginTop: "24px" }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setResetStep(0)}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => setResetStep(2)}
                      disabled={
                        !resetData.newPassword ||
                        resetData.newPassword.length < 6 ||
                        resetData.newPassword !== resetData.confirmNewPassword
                      }
                    >
                      Security Check
                    </button>
                  </div>
                </div>
              )}

              {resetStep === 2 && (
                <form onSubmit={handleResetPassword}>
                  <div
                    style={{
                      padding: "16px",
                      background: "var(--amber-50)",
                      border: "1px solid var(--amber-200)",
                      borderRadius: "8px",
                      marginBottom: "20px",
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 10px 0",
                        color: "var(--amber-800)",
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <AppIcon icon={faUserShield} /> Final Security Check
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        color: "var(--amber-700)",
                        lineHeight: "1.5",
                      }}
                    >
                      As a final security step, please re-enter **YOUR**
                      original password to complete the reset for{" "}
                      <strong>{selectedUser.username}</strong>.
                    </p>
                  </div>
                  <div className="form-group">
                    <label htmlFor="final-confirm-pass">
                      Confirm Your Password Again
                    </label>
                    <input
                      id="final-confirm-pass"
                      type="password"
                      required
                      autoFocus
                      placeholder="Re-enter your current password"
                      value={resetData.currentPassword}
                      onChange={(e) =>
                        setResetData({
                          ...resetData,
                          currentPassword: e.target.value,
                        })
                      }
                      className="form-input"
                    />
                  </div>
                  <div className="modal-actions" style={{ marginTop: "24px" }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setResetStep(1)}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ background: "var(--green-600)" }}
                    >
                      Complete Password Reset
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagementPage;
