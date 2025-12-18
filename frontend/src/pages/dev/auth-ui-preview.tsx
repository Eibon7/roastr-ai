/**
 * Auth UI Preview Page (DEV ONLY)
 *
 * Visual validation page for auth components.
 * This page is only available in development mode.
 *
 * Route: /dev/auth-ui-preview
 */

import * as React from 'react';
import { EmailInput, PasswordInput, AuthButton, AuthForm } from '@/components/auth';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AuthUIPreview() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [emailError, setEmailError] = React.useState(false);
  const [passwordError, setPasswordError] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFormError(null);

    // Simulate validation
    setTimeout(() => {
      if (!email) {
        setEmailError(true);
        setFormError('Email is required');
      } else if (!password) {
        setPasswordError(true);
        setFormError('Password is required');
      } else {
        setFormError(null);
        setEmailError(false);
        setPasswordError(false);
      }
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Auth UI Components Preview</h1>
          <p className="text-muted-foreground mt-2">
            Visual validation page for auth components. DEV ONLY.
          </p>
        </div>

        {/* EmailInput Examples */}
        <Card>
          <CardHeader>
            <CardTitle>EmailInput Component</CardTitle>
            <CardDescription>Email input with error state support</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-normal">Normal State</Label>
              <EmailInput
                id="email-normal"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(false);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-error">Error State</Label>
              <EmailInput
                id="email-error"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(false);
                }}
                hasError={emailError}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email-disabled">Disabled State</Label>
              <EmailInput
                id="email-disabled"
                placeholder="user@example.com"
                value="disabled@example.com"
                disabled
              />
            </div>
          </CardContent>
        </Card>

        {/* PasswordInput Examples */}
        <Card>
          <CardHeader>
            <CardTitle>PasswordInput Component</CardTitle>
            <CardDescription>Password input with visibility toggle and error state</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password-normal">Normal State</Label>
              <PasswordInput
                id="password-normal"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(false);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password-error">Error State</Label>
              <PasswordInput
                id="password-error"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(false);
                }}
                hasError={passwordError}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password-disabled">Disabled State</Label>
              <PasswordInput
                id="password-disabled"
                placeholder="Enter your password"
                value="password123"
                disabled
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password-no-toggle">Without Toggle</Label>
              <PasswordInput
                id="password-no-toggle"
                placeholder="Enter your password"
                showToggle={false}
              />
            </div>
          </CardContent>
        </Card>

        {/* AuthButton Examples */}
        <Card>
          <CardHeader>
            <CardTitle>AuthButton Component</CardTitle>
            <CardDescription>Button with loading state for auth actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Normal State</Label>
              <AuthButton type="button" className="mt-2">
                Login
              </AuthButton>
            </div>

            <div>
              <Label>Loading State</Label>
              <AuthButton type="button" loading loadingText="Iniciando sesión..." className="mt-2">
                Login
              </AuthButton>
            </div>

            <div>
              <Label>Disabled State</Label>
              <AuthButton type="button" disabled className="mt-2">
                Login
              </AuthButton>
            </div>
          </CardContent>
        </Card>

        {/* AuthForm Example */}
        <Card>
          <CardHeader>
            <CardTitle>AuthForm Component</CardTitle>
            <CardDescription>Complete form with error handling</CardDescription>
          </CardHeader>
          <CardContent>
            <AuthForm onSubmit={handleSubmit} error={formError} loading={loading}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="form-email">Email</Label>
                  <EmailInput
                    id="form-email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError(false);
                      setFormError(null);
                    }}
                    hasError={emailError}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="form-password">Password</Label>
                  <PasswordInput
                    id="form-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordError(false);
                      setFormError(null);
                    }}
                    hasError={passwordError}
                    required
                    disabled={loading}
                  />
                </div>

                <AuthButton type="submit" loading={loading} loadingText="Validating...">
                  Submit Form
                </AuthButton>
              </div>
            </AuthForm>
          </CardContent>
        </Card>

        {/* Validation Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Visual Validation Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>Inputs use shadcn/ui Input component (check typography, padding, focus ring)</li>
              <li>Error states show border-destructive and aria-invalid="true"</li>
              <li>Button shows Loader2 spinner when loading</li>
              <li>Button is disabled when loading or disabled prop is true</li>
              <li>Focus states are visible (keyboard navigation)</li>
              <li>Labels are correctly associated with inputs (htmlFor/id)</li>
              <li>No custom CSS or HTML native inputs visible</li>
              <li>All components work in light/dark/system theme</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

