/**
 * Guardian Agent - Base Tag Component
 * Phase 17: Governance Interface & Alerts
 *
 * Shared tag component for SeverityTag and ActionTag to eliminate duplication
 */

import React from 'react';

export interface BaseTagProps {
  /**
   * Text to display in the tag
   */
  label: string;

  /**
   * Border and background color
   */
  color: string;

  /**
   * Whether to use transparent background (border only)
   * @default false
   */
  isTransparent?: boolean;

  /**
   * Custom text color (overrides default)
   * If not provided, uses black for filled tags, color for transparent tags
   */
  textColor?: string;

  /**
   * Optional CSS class name
   */
  className?: string;

  /**
   * Optional title attribute (tooltip)
   */
  title?: string;
}

/**
 * Base tag component with Snake Eater theme styling
 *
 * Used by SeverityTag and ActionTag to provide consistent styling
 * while eliminating code duplication
 *
 * @example
 * ```tsx
 * <BaseTag
 *   label="CRITICAL"
 *   color="#FF0000"
 *   title="Severity: Critical"
 * />
 *
 * <BaseTag
 *   label="APPROVED"
 *   color="#00FF41"
 *   isTransparent={true}
 *   title="Action: Approved"
 * />
 * ```
 */
export const BaseTag: React.FC<BaseTagProps> = ({
  label,
  color,
  isTransparent = false,
  textColor,
  className = '',
  title
}) => {
  const baseStyles: React.CSSProperties = {
    display: 'inline-block',
    padding: '4px 12px',
    fontSize: '11px',
    fontWeight: 'bold',
    fontFamily: "'Courier New', monospace",
    textTransform: 'uppercase',
    border: `2px solid ${color}`,
    backgroundColor: isTransparent ? 'transparent' : color,
    color: textColor || (isTransparent ? color : '#000'),
    borderRadius: '0', // Sharp corners (Snake Eater theme)
    letterSpacing: '1px'
  };

  return (
    <span style={baseStyles} className={className} title={title || label}>
      {label}
    </span>
  );
};

export default BaseTag;
