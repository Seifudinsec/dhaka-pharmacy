import React from 'react';
import AppIcon from './AppIcon';

export default function MetricCard({ label, value, sub, tone = 'primary', icon }) {
  return (
    <div className={`metric-card metric-${tone}`}>
      {icon ? <div className="metric-icon"><AppIcon icon={icon} size="lg" /></div> : null}
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub ? <div className="metric-sub">{sub}</div> : null}
    </div>
  );
}
