import React from 'react';

export default function UsersTable({ users, onRoleChange, onDelete }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const isMainAdmin = u.isMainAdmin || u.role === 'main_admin';
            const roleLabel = isMainAdmin ? 'Main Admin' : u.role === 'admin' ? 'Admin' : 'Pharmacist';
            return (
              <tr key={u._id || u.id}>
                <td>{u.username}</td>
                <td>
                  <span className="role-badge">
                    {roleLabel}
                  </span>
                  {isMainAdmin && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--slate-500)' }}>
                      (Permanent)
                    </span>
                  )}
                </td>
                <td style={{ textTransform: 'capitalize' }}>{u.status || 'active'}</td>
                <td>
                  {isMainAdmin ? (
                    <span style={{ fontSize: 12, color: 'var(--slate-500)' }}>—</span>
                  ) : (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => onDelete?.(u._id || u.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
