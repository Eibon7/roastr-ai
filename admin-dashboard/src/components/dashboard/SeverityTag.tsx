/**
 * Guardian Agent - Severity Tag Component
 * Phase 17: Governance Interface & Alerts
 *
 * Displays severity level with Snake Eater theme styling
 */

import React from 'react';
import { GuardianSeverity, GUARDIAN_COLORS, SEVERITY_LABELS } from '../../types/guardian.types';

interface SeverityTagProps {
  severity: GuardianSeverity;
  className?: string;
}

export const SeverityTag: React.FC<SeverityTagProps> = ({ severity, className = '' }) => {
  const color = GUARDIAN_COLORS[severity.toLowerCase() as keyof typeof GUARDIAN_COLORS];
  const label = SEVERITY_LABELS[severity];

  const baseStyles = {
    display: 'inline-block',
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: 'bold',
    fontFamily: "'Courier New', monospace",
    textTransform: 'uppercase' as const,
    border: `2px solid ${color}`,
    backgroundColor: severity === 'SAFE' ? 'transparent' : color,
    color: severity === 'SAFE' ? color : '#000',
    borderRadius: '0', // Sharp corners (Snake Eater)
    letterSpacing: '1px'
  };

  return (
    <span style={baseStyles} className={className} title={`Severity: ${label}`}>
      {label}
    </span>
  );
};

export default SeverityTag;
