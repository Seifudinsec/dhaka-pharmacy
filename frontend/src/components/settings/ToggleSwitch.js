import React from 'react';

export default function ToggleSwitch({ checked, onChange, label, hint }) {
  return (
    <label className="settings-toggle-row">
      <div>
        <div className="settings-toggle-label">{label}</div>
        {hint ? <div className="settings-toggle-hint">{hint}</div> : null}
      </div>
      <span className={`toggle-switch ${checked ? 'active' : ''}`} onClick={() => onChange(!checked)} role="switch" aria-checked={checked} tabIndex={0}>
        <span className="toggle-dot" />
      </span>
    </label>
  );
}
