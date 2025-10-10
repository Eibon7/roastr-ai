/**
 * Guardian Agent - Action Tag Component
 * Phase 17: Governance Interface & Alerts
 *
 * Displays action status with Snake Eater theme styling
 */

import React from 'react';
import { GUARDIAN_COLORS, ACTION_LABELS, ActionTagProps } from '../../types/guardian.types';
import BaseTag from './BaseTag';

// ✅ Hoisted outside component (performance optimization)
const colorMap = {
  BLOCKED: GUARDIAN_COLORS.blocked,
  REVIEW: GUARDIAN_COLORS.review,
  APPROVED: GUARDIAN_COLORS.approved,
  DENIED: GUARDIAN_COLORS.denied
};

export const ActionTag: React.FC<ActionTagProps> = ({ action, className = '' }) => {
  const color = colorMap[action];
  const label = ACTION_LABELS[action];
  const isTransparent = action === 'APPROVED';
  const textColor = action === 'APPROVED' ? color : action === 'DENIED' ? '#FFF' : '#000';

  return (
    <BaseTag
      label={label}
      color={color}
      isTransparent={isTransparent}
      textColor={textColor}
      className={className}
      title={`Action: ${label}`}
    />
  );
};

export default ActionTag;
