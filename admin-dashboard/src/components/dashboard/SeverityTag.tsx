/**
 * Guardian Agent - Severity Tag Component
 * Phase 17: Governance Interface & Alerts
 *
 * Displays severity level with Snake Eater theme styling
 */

import React from 'react';
import { GUARDIAN_COLORS, SEVERITY_LABELS, SeverityTagProps } from '../../types/guardian.types';
import BaseTag from './BaseTag';

// ✅ Hoisted outside component (performance optimization)
const colorMap = {
  CRITICAL: GUARDIAN_COLORS.critical,
  SENSITIVE: GUARDIAN_COLORS.sensitive,
  SAFE: GUARDIAN_COLORS.safe
};

export const SeverityTag: React.FC<SeverityTagProps> = ({ severity, className = '' }) => {
  const color = colorMap[severity];
  const label = SEVERITY_LABELS[severity];
  const isTransparent = severity === 'SAFE';
  const textColor = severity === 'SAFE' ? color : '#000';

  return (
    <BaseTag
      label={label}
      color={color}
      isTransparent={isTransparent}
      textColor={textColor}
      className={className}
      title={`Severity: ${label}`}
    />
  );
};

export default SeverityTag;
