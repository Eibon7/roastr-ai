import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AuthButtonProps extends ButtonProps {
  /**
   * Whether the button is in a loading state
   * @default false
   */
  loading?: boolean;
  /**
   * Loading text to display when loading is true
   * @default "Cargando..."
   */
  loadingText?: string;
  /**
   * Children to display when not loading
   */
  children: React.ReactNode;
}

/**
 * AuthButton Component
 *
 * A specialized button component for authentication actions with loading state.
 * Uses shadcn/ui Button as base and adds loading spinner functionality.
 *
 * @example
 * ```tsx
 * <AuthButton
 *   type="submit"
 *   loading={isSubmitting}
 *   loadingText="Iniciando sesión..."
 * >
 *   Iniciar Sesión
 * </AuthButton>
 * ```
 */
const AuthButton = React.forwardRef<HTMLButtonElement, AuthButtonProps>(
  ({ className, loading = false, loadingText = 'Cargando...', children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn('w-full', className)}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {loadingText}
          </>
        ) : (
          children
        )}
      </Button>
    );
  }
);

AuthButton.displayName = 'AuthButton';

export { AuthButton };

