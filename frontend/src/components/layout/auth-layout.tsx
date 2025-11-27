import * as React from 'react';
import { Shield } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AuthLayout({
  children,
  title = 'Roastr.ai',
  description = 'Detección de toxicidad y moderación inteligente'
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo and branding */}
        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center space-x-2">
            <Shield className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold">{title}</h1>
          </div>
          {description && (
            <p className="text-muted-foreground text-center text-sm">{description}</p>
          )}
        </div>

        {/* Auth form card */}
        <div className="bg-card rounded-lg border p-6 shadow-sm">{children}</div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Roastr.ai. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}

