/**
 * Guardian Agent - Base Tag Component
 * Phase 17: Governance Interface & Alerts
 *
 * MIGRATED: MUI Chip → shadcn Badge
 * Eliminado styled-components, ahora usa Badge + Tailwind
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface BaseTagProps {
  /**
   * Text to display in the tag
   */
  label: string;

  /**
   * Border and background color (hex format)
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
 * Base tag component migrado a shadcn Badge
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
  // Convertir color hex a variables de estilo inline
  const style = {
    borderColor: color,
    backgroundColor: isTransparent ? 'transparent' : color,
    color: textColor || (isTransparent ? color : '#000'),
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-mono text-xs font-bold uppercase tracking-wider border-2 rounded-none px-3 py-1',
        className
      )}
      style={style}
      title={title || label}
    >
      {label}
    </Badge>
  );
};

export default BaseTag;
