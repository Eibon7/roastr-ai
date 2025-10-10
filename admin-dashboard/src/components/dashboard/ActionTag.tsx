/**
 * Guardian Agent - Action Tag Component
 * Phase 17: Governance Interface & Alerts
 *
 * Displays action status with Snake Eater theme styling
 */

import React from 'react';
import { GuardianAction, GUARDIAN_COLORS, ACTION_LABELS } from '../../types/guardian.types';

interface ActionTagProps {
  action: GuardianAction;
  className?: string;
}

export const ActionTag: React.FC<ActionTagProps> = ({ action, className = '' }) => {
  const colorMap = {
    BLOCKED: GUARDIAN_COLORS.blocked,
    REVIEW: GUARDIAN_COLORS.review,
    APPROVED: GUARDIAN_COLORS.approved,
    DENIED: GUARDIAN_COLORS.denied
  };

  const color = colorMap[action];
  const label = ACTION_LABELS[action];

  const baseStyles = {
    display: 'inline-block',
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: 'bold',
    fontFamily: "'Courier New', monospace",
    textTransform: 'uppercase' as const,
    border: `2px solid ${color}`,
    backgroundColor: action === 'APPROVED' ? 'transparent' : color,
    color: action === 'APPROVED' ? color : action === 'DENIED' ? '#FFF' : '#000',
    borderRadius: '0', // Sharp corners (Snake Eater)
    letterSpacing: '1px'
  };

  return (
    <span style={baseStyles} className={className} title={`Action: ${label}`}>
      {label}
    </span>
  );
};

export default ActionTag;
