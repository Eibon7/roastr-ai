import * as React from 'react';
import { cn } from '@/lib/utils';

export interface AuthFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  /**
   * Error message to display
   */
  error?: string | null;
  /**
   * Whether the form is in a loading state
   */
  loading?: boolean;
  /**
   * Children form content
   */
  children: React.ReactNode;
}

/**
 * AuthForm Component
 *
 * A base form component for authentication with error handling and loading states.
 * Provides consistent structure for auth forms across the application.
 *
 * @example
 * ```tsx
 * <AuthForm
 *   onSubmit={handleSubmit}
 *   error={error}
 *   loading={isLoading}
 * >
 *   <div className="space-y-4">
 *     <EmailInput ... />
 *     <PasswordInput ... />
 *     <AuthButton type="submit" loading={isLoading}>
 *       Iniciar Sesión
 *     </AuthButton>
 *   </div>
 * </AuthForm>
 * ```
 */
const AuthForm = React.forwardRef<HTMLFormElement, AuthFormProps>(
  ({ className, error, loading, children, ...props }, ref) => {
    return (
      <form ref={ref} className={cn('space-y-4', className)} {...props}>
        {children}
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive" role="alert">
            {error}
          </div>
        )}
      </form>
    );
  }
);

AuthForm.displayName = 'AuthForm';

export { AuthForm };


