import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface EmailInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Whether to show validation error state
   * @default false
   */
  hasError?: boolean;
}

/**
 * EmailInput Component
 *
 * A specialized input component for email fields with validation support.
 * Uses shadcn/ui Input as base and adds email-specific attributes.
 *
 * @example
 * ```tsx
 * <EmailInput
 *   id="email"
 *   placeholder="tu@email.com"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 *   hasError={!!emailError}
 * />
 * ```
 */
const EmailInput = React.forwardRef<HTMLInputElement, EmailInputProps>(
  ({ className, hasError, ...props }, ref) => {
    return (
      <Input
        type="email"
        autoComplete="email"
        className={cn(
          hasError && 'border-destructive focus-visible:ring-destructive',
          className
        )}
        aria-invalid={hasError}
        ref={ref}
        {...props}
      />
    );
  }
);

EmailInput.displayName = 'EmailInput';

export { EmailInput };

