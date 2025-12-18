import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /**
   * Whether to show the password visibility toggle button
   * @default true
   */
  showToggle?: boolean;
}

/**
 * PasswordInput Component
 *
 * A specialized input component for password fields with visibility toggle.
 * Uses shadcn/ui Input as base and adds eye icon toggle functionality.
 *
 * @example
 * ```tsx
 * <PasswordInput
 *   id="password"
 *   placeholder="Enter your password"
 *   value={password}
 *   onChange={(e) => setPassword(e.target.value)}
 * />
 * ```
 */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, showToggle = true, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const toggleVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    return (
      <div className="relative">
        <Input
          type={showPassword ? 'text' : 'password'}
          className={cn('pr-10', className)}
          ref={ref}
          {...props}
        />
        {showToggle && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={toggleVisibility}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export { PasswordInput };

