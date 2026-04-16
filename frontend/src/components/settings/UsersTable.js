import React from 'react';

export default function UsersTable({ users, onRoleChange, onDelete }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Username</th><th>Role</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id || u.id}>
              <td>{u.username}</td>
              <td>
                <select className="form-control" value={u.role === 'cashier' ? 'pharmacist' : u.role} onChange={(e) => onRoleChange(u._id || u.id, e.target.value)}>
                  <option value="admin">Admin</option>
                  <option value="pharmacist">Pharmacist</option>
                </select>
              </td>
              <td>
                <button className="btn btn-danger btn-sm" disabled={u.username === 'admin'} onClick={() => onDelete(u._id || u.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
