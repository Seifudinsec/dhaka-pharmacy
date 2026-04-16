import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { faBell, faDatabase, faDownload, faFloppyDisk, faPalette, faRotateLeft, faTriangleExclamation, faUserGroup, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import ToggleSwitch from '../components/settings/ToggleSwitch';
import ConfirmModal from '../components/settings/ConfirmModal';
import UsersTable from '../components/settings/UsersTable';
import AppIcon from '../components/common/AppIcon';

const TABS = [
  { id: 'notifications', label: 'Notifications', icon: faBell },
  { id: 'data', label: 'Data Management', icon: faDatabase },
  { id: 'users', label: 'Users & Roles', icon: faUserGroup },
  { id: 'appearance', label: 'Appearance', icon: faPalette },
  { id: 'danger', label: 'Danger Zone', icon: faTriangleExclamation },
];

export default function SettingsPage({ theme, onThemeChange, notificationSettings, onNotificationSettingsChange }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const restoreInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('notifications');
  const [notif, setNotif] = useState({
    lowStock: true,
    expiry: true,
    dailySales: false,
  });
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifDraftDirty, setNotifDraftDirty] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'pharmacist' });
  const [confirm, setConfirm] = useState(null);

  const openConfirm = (payload) => setConfirm(payload);
  const closeConfirm = () => setConfirm(null);

  useEffect(() => {
    if (!notificationSettings) return;
    if (notifDraftDirty) return;
    setNotif({
      lowStock: notificationSettings.notificationPreferences?.lowStock ?? true,
      expiry: notificationSettings.notificationPreferences?.expiry ?? true,
      dailySales: notificationSettings.notificationPreferences?.dailySales ?? false,
    });
  }, [notificationSettings, notifDraftDirty]);

  useEffect(() => {
    if (!isAdmin) return;
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const { data } = await api.get('/users');
        if (data.success) setUsers(data.data || []);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to load users.');
      } finally {
        setLoadingUsers(false);
      }
    };
    loadUsers();
  }, [isAdmin]);

  const exportSalesCsv = async () => {
    try {
      const { data } = await api.get('/sales', { params: { limit: 1000 } });
      const rows = data?.data || [];
      const csvRows = [
        ['Date', 'Served By', 'Items', 'Total (KES)', 'Profit (KES)'],
        ...rows.map((sale) => [
          new Date(sale.createdAt).toISOString(),
          sale.servedBy?.username || '',
          sale.items?.map((i) => `${i.medicineName} x${i.quantity}`).join(' | ') || '',
          sale.total ?? 0,
          sale.totalProfit ?? 0,
        ]),
      ];
      const csvContent = csvRows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales_export_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Sales export generated.');
    } catch {
      toast.error('Failed to export sales data.');
    }
  };

  const createBackup = async () => {
    try {
      const { data } = await api.post('/settings/backup');
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dhaka_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup file downloaded.');
    } catch {
      toast.error('Failed to generate backup.');
    }
  };

  const handleRestore = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const payload = JSON.parse(String(reader.result || '{}'));
        const { data } = await api.post('/settings/restore', payload);
        toast.success(data.message || 'Restore completed.');
      } catch (error) {
        toast.error(error.response?.data?.message || 'Invalid restore file.');
      }
    };
    reader.readAsText(file);
  };

  const addUser = async () => {
    try {
      const { data } = await api.post('/users', {
        username: newUser.username.trim(),
        password: newUser.password,
        role: newUser.role,
      });
      toast.success(data.message || 'User created.');
      setNewUser({ username: '', password: '', role: 'pharmacist' });
      const usersRes = await api.get('/users');
      if (usersRes.data.success) setUsers(usersRes.data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create user.');
    }
  };

  const deleteUser = async (id) => {
    try {
      const { data } = await api.delete(`/users/${id}`);
      toast.success(data.message || 'User deleted.');
      setUsers((prev) => prev.filter((u) => (u._id || u.id) !== id));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete user.');
    }
  };

  const updateRole = async (id, role) => {
    try {
      await api.put(`/users/${id}`, { role });
      setUsers((prev) => prev.map((u) => ((u._id || u.id) === id ? { ...u, role } : u)));
      toast.success('User role updated.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update role.');
    }
  };

  const saveNotificationSettings = async () => {
    setSavingNotif(true);
    try {
      const { data } = await api.put('/settings/notifications/me', {
        notificationPreferences: notif,
      });
      if (data.success) {
        onNotificationSettingsChange?.(data.data);
        localStorage.setItem('dhaka_notification_settings', JSON.stringify(data.data));
        setNotifDraftDirty(false);
        toast.success(data.message || 'Notification settings saved.');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save notification settings.');
    } finally {
      setSavingNotif(false);
    }
  };

  const content = useMemo(() => {
    if (activeTab === 'notifications') {
      return (
        <div className="settings-content-stack">
          <div className="card"><div className="card-header"><h2>Notifications & Alerts</h2></div><div className="card-body">
            <ToggleSwitch checked={notif.lowStock} onChange={(v) => { setNotif((p) => ({ ...p, lowStock: v })); setNotifDraftDirty(true); }} label="Low stock alerts" hint="Alert when medicine stock is below threshold." />
            <ToggleSwitch checked={notif.expiry} onChange={(v) => { setNotif((p) => ({ ...p, expiry: v })); setNotifDraftDirty(true); }} label="Expiry alerts" hint="Receive warnings for near-expiry medicines." />
            <ToggleSwitch checked={notif.dailySales} onChange={(v) => { setNotif((p) => ({ ...p, dailySales: v })); setNotifDraftDirty(true); }} label="Daily sales summary" hint="Get a daily summary report." />
            <div style={{ marginTop: 14 }}>
              <button className="btn btn-primary" onClick={saveNotificationSettings} disabled={savingNotif}>
                {savingNotif ? 'Saving...' : 'Save Notification Settings'}
              </button>
            </div>
          </div></div>
        </div>
      );
    }

    if (activeTab === 'data') {
      return (
        <div className="settings-content-stack">
          <div className="card"><div className="card-header"><h2>Data Management</h2></div><div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => openConfirm({ title: 'Export Sales Data', message: 'Export sales data to CSV now?', confirmText: 'Export', action: exportSalesCsv, tone: 'primary' })}><AppIcon icon={faDownload} /> Export Sales (CSV/Excel)</button>
            <button className="btn btn-secondary" onClick={() => openConfirm({ title: 'Backup System Data', message: 'Create and download a backup file now?', confirmText: 'Create Backup', action: createBackup, tone: 'primary' })}><AppIcon icon={faFloppyDisk} /> Backup Data</button>
            <button className="btn btn-secondary" onClick={() => restoreInputRef.current?.click()}><AppIcon icon={faRotateLeft} /> Restore Backup</button>
            <input ref={restoreInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={(e) => handleRestore(e.target.files?.[0])} />
          </div></div>
        </div>
      );
    }

    if (activeTab === 'users') {
      if (!isAdmin) return <div className="alert alert-warning">Only admin users can access User & Roles management.</div>;
      return (
        <div className="settings-content-stack">
          <div className="card"><div className="card-header"><h2>Add User</h2></div><div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Username</label>
                <input className="form-control" value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))} placeholder="e.g. pharmacist1" />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-control" type="password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} placeholder="At least 6 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-control" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}>
                  <option value="admin">Admin</option>
                  <option value="pharmacist">Pharmacist</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" onClick={addUser}><AppIcon icon={faUserPlus} /> Add User</button>
          </div></div>
          <div className="card"><div className="card-header"><h2>Manage Users</h2></div><div className="card-body">
            {loadingUsers ? <div className="loading-center"><div className="spinner" /></div> : <UsersTable users={users} onRoleChange={updateRole} onDelete={deleteUser} />}
          </div></div>
        </div>
      );
    }

    if (activeTab === 'appearance') {
      return (
        <div className="settings-content-stack">
          <div className="card"><div className="card-header"><h2>Appearance</h2></div><div className="card-body">
            <ToggleSwitch
              checked={theme === 'dark'}
              onChange={(v) => onThemeChange(v ? 'dark' : 'light')}
              label="Dark mode"
              hint="Apply dark theme globally across the system."
            />
          </div></div>
        </div>
      );
    }

    return (
      <div className="settings-content-stack">
        <div className="card danger-card"><div className="card-header"><h2>Danger Zone</h2></div><div className="card-body" style={{ display: 'grid', gap: 10 }}>
          <button className="btn btn-danger" onClick={() => openConfirm({
            title: 'Reset System',
            message: 'This will reset key settings to defaults. Continue?',
            confirmText: 'Reset',
            action: async () => {
              const { data } = await api.post('/settings/danger/reset-system');
              toast.success(data.message || 'System reset completed.');
            },
          })}>Reset System</button>
          <button className="btn btn-danger" onClick={() => openConfirm({
            title: 'Delete All Data',
            message: 'This is irreversible. All operational data will be permanently deleted.',
            confirmText: 'Delete All Data',
            action: async () => {
              const { data } = await api.post('/settings/danger/delete-all-data');
              toast.success(data.message || 'All data deleted.');
            },
          })}>Delete All Data</button>
          <button className="btn btn-danger" onClick={() => openConfirm({
            title: 'Logout All Devices',
            message: 'This will invalidate all active sessions for your account.',
            confirmText: 'Logout All',
            action: async () => {
              const { data } = await api.post('/settings/danger/logout-all-devices');
              toast.success(data.message || 'Logged out from all devices.');
            },
          })}>Logout From All Devices</button>
        </div></div>
      </div>
    );
  }, [activeTab, notif, users, newUser, isAdmin, theme, onThemeChange]);

  return (
    <div className="settings-page">
      <div className="card">
        <div className="card-header"><h2>System Settings</h2></div>
        <div className="settings-layout">
          <aside className="settings-tabs">
            {TABS.map((tab) => (
              <button key={tab.id} className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                <AppIcon icon={tab.icon} className="settings-tab-icon" /> {tab.label}
              </button>
            ))}
          </aside>
          <section className="settings-content">{content}</section>
        </div>
      </div>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmText={confirm?.confirmText}
        tone={confirm?.tone}
        onCancel={closeConfirm}
        onConfirm={() => {
          Promise.resolve(confirm?.action?.())
            .catch((error) => {
              toast.error(error.response?.data?.message || 'Action failed.');
            })
            .finally(() => closeConfirm());
        }}
      />
    </div>
  );
}
