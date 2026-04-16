import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function AppIcon({ icon, size = 'md', tone = 'default', className = '' }) {
  return (
    <span className={`app-icon app-icon-${size} app-icon-${tone} ${className}`.trim()} aria-hidden="true">
      <FontAwesomeIcon icon={icon} fixedWidth />
    </span>
  );
}
