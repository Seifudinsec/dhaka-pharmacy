import React from 'react';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
import AppIcon from '../common/AppIcon';

export default function ConfirmModal({ open, title, message, confirmText = 'Confirm', tone = 'danger', onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onCancel}><AppIcon icon={faXmark} /></button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--gray-700)', fontSize: 14 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
