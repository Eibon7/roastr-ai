/**
 * Guardian Agent - Corner Separator Component
 * Phase 17: Governance Interface & Alerts
 *
 * Snake Eater themed separator line
 */

import React from 'react';
import { GUARDIAN_COLORS } from '../../types/guardian.types';

interface CornerSeparatorProps {
  className?: string;
}

export const CornerSeparator: React.FC<CornerSeparatorProps> = ({ className = '' }) => {
  const containerStyles = {
    display: 'flex',
    alignItems: 'center',
    margin: '20px 0',
    fontFamily: "'Courier New', monospace",
    fontSize: '14px',
    color: GUARDIAN_COLORS.safe,
    opacity: 0.6
  };

  const lineStyles = {
    flex: 1,
    height: '2px',
    backgroundColor: GUARDIAN_COLORS.safe,
    opacity: 0.3
  };

  return (
    <div style={containerStyles} className={className}>
      <span style={{ marginRight: '10px' }}>└</span>
      <div style={lineStyles} />
      <span style={{ margin: '0 10px' }}>─</span>
      <div style={lineStyles} />
      <span style={{ marginLeft: '10px' }}>┘</span>
    </div>
  );
};

export default CornerSeparator;
