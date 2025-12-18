import * as React from 'react';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmailInput } from './email-input';
import { AuthForm, AuthFormProps } from './auth-form';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface MagicLinkFormProps extends Omit<AuthFormProps, 'children'> {
  /**
   * Email value
   */
  email: string;
  /**
   * Email change handler
   */
  onEmailChange: (email: string) => void;
  /**
   * Submit handler
   */
  onSubmit: (e: React.FormEvent) => void | Promise<void>;
  /**
   * Success message to display
   */
  successMessage?: string | null;
  /**
   * Label for email input
   * @default "Email"
   */
  emailLabel?: string;
  /**
   * Placeholder for email input
   * @default "tu@email.com"
   */
  emailPlaceholder?: string;
  /**
   * Button text
   * @default "Enviar enlace mágico"
   */
  buttonText?: string;
}

/**
 * MagicLinkForm Component
 *
 * A specialized form component for magic link authentication.
 * Combines EmailInput, AuthForm, and AuthButton for a complete magic link flow.
 *
 * @example
 * ```tsx
 * <MagicLinkForm
 *   email={email}
 *   onEmailChange={setEmail}
 *   onSubmit={handleSubmit}
 *   loading={isLoading}
 *   error={error}
 *   successMessage={successMessage}
 * />
 * ```
 */
const MagicLinkForm = React.forwardRef<HTMLFormElement, MagicLinkFormProps>(
  (
    {
      className,
      email,
      onEmailChange,
      onSubmit,
      error,
      loading,
      successMessage,
      emailLabel = 'Email',
      emailPlaceholder = 'tu@email.com',
      buttonText = 'Enviar enlace mágico',
      ...props
    },
    ref
  ) => {
    if (successMessage) {
      return (
        <div className={cn('space-y-4', className)}>
          <div className="rounded-md bg-muted p-4 text-sm">
            <p className="mb-2">{successMessage}</p>
            <p className="text-muted-foreground">
              Revisa tu bandeja de entrada. Si no recibes el email, verifica tu carpeta de spam.
            </p>
          </div>
        </div>
      );
    }

    return (
      <AuthForm ref={ref} className={className} onSubmit={onSubmit} error={error} loading={loading} {...props}>
        <div className="space-y-2">
          <Label htmlFor="email">{emailLabel}</Label>
          <EmailInput
            id="email"
            placeholder={emailPlaceholder}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            hasError={!!error}
            required
            autoFocus
            disabled={loading}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Mail className="mr-2 h-4 w-4 animate-pulse" />
              Enviando...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              {buttonText}
            </>
          )}
        </Button>
      </AuthForm>
    );
  }
);

MagicLinkForm.displayName = 'MagicLinkForm';

export { MagicLinkForm };

