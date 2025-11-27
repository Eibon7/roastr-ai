import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { SettingsSection } from '../roastr/SettingsSection';
import {
  Download,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  Shield,
  LogOut
} from 'lucide-react';
import { apiClient } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import PasswordStrengthIndicator from '../PasswordStrengthIndicator';

/**
 * AccountSettingsForm - Form component for account settings
 * 
 * Displays:
 * - Email address (read-only)
 * - Password change form
 * - GDPR data export
 * - GDPR transparency information
 * - Account deletion
 * 
 * Issue #1054: Implementar tab de Cuenta (/app/settings/account)
 */
const AccountSettingsForm = () => {
  const { userData: user, signOut } = useAuth();
  const navigate = useNavigate();
  const notificationTimeoutRef = useRef(null);

  // Loading states
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Password form states
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Account deletion states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  const showNotification = (message, type = 'success') => {
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    } else {
      toast.info(message);
    }
  };

  const validatePassword = (password) => {
    const errors = [];

    if (password.length < 8) {
      errors.push('At least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('One uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('One lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('One number');
    }

    if (!/[!@#$%^&*()_+\-=[\]{}|;':".,<>?`~]/.test(password)) {
      errors.push('One special character');
    }

    return errors;
  };

  const getPasswordStrength = (password) => {
    const errors = validatePassword(password);
    const score = 5 - errors.length;

    if (score <= 1) return { strength: 'weak', color: 'bg-red-500', text: 'Weak' };
    if (score <= 3) return { strength: 'medium', color: 'bg-yellow-500', text: 'Medium' };
    return { strength: 'strong', color: 'bg-green-500', text: 'Strong' };
  };

  const isPasswordFormValid = () => {
    return (
      passwords.current.trim() &&
      passwords.new.trim() &&
      passwords.confirm.trim() &&
      passwords.new === passwords.confirm &&
      validatePassword(passwords.new).length === 0 &&
      passwords.current !== passwords.new
    );
  };

  const handlePasswordChange = async () => {
    // Pre-validate current password
    if (!passwords.current.trim()) {
      showNotification('Current password is required', 'error');
      return;
    }

    // Pre-validate new password
    const validationErrors = validatePassword(passwords.new);
    if (validationErrors.length > 0) {
      showNotification(`Password must contain: ${validationErrors.join(', ')}`, 'error');
      return;
    }

    // Check password confirmation
    if (passwords.new !== passwords.confirm) {
      showNotification('New passwords do not match', 'error');
      return;
    }

    // Check if new password is different from current
    if (passwords.current === passwords.new) {
      showNotification('New password must be different from current password', 'error');
      return;
    }

    try {
      setPasswordLoading(true);
      await apiClient.post('/auth/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.new
      });

      setPasswords({ current: '', new: '', confirm: '' });
      showNotification('Password changed successfully', 'success');
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to change password';
      showNotification(errorMessage, 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDataExport = async () => {
    try {
      setExportLoading(true);
      await apiClient.post('/auth/export-data');
      showNotification('Data export initiated. You will receive an email when ready.', 'success');
    } catch (error) {
      showNotification('Failed to initiate data export', 'error');
    } finally {
      setExportLoading(false);
    }
  };

  const handleAccountDeletion = async () => {
    if (deleteConfirmText !== 'DELETE') {
      showNotification('Please type DELETE to confirm', 'error');
      return;
    }

    try {
      setDeleteLoading(true);
      await apiClient.post('/auth/delete-account');
      showNotification('Account deletion initiated', 'success');
      // Navigate to logout or landing page
      navigate('/');
    } catch (error) {
      showNotification('Failed to delete account', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Information */}
      <SettingsSection
        title="Account Information"
        description="Manage your account details and security settings"
        kicker="Security"
      >
        {/* Email Display */}
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={user?.email || ''}
            disabled
            className="bg-gray-50"
          />
          <p className="text-sm text-gray-500">Email changes require contacting support</p>
        </div>

        {/* Password Change */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Change Password</h3>

          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showPasswords.current ? 'text' : 'password'}
                value={passwords.current}
                onChange={(e) => setPasswords((prev) => ({ ...prev, current: e.target.value }))}
                placeholder="Enter current password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() =>
                  setShowPasswords((prev) => ({ ...prev, current: !prev.current }))
                }
                aria-label={
                  showPasswords.current ? 'Hide current password' : 'Show current password'
                }
              >
                {showPasswords.current ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPasswords.new ? 'text' : 'password'}
                value={passwords.new}
                onChange={(e) => setPasswords((prev) => ({ ...prev, new: e.target.value }))}
                placeholder="Enter new password"
                aria-describedby={
                  validatePassword(passwords.new).length > 0
                    ? 'password-requirements'
                    : undefined
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowPasswords((prev) => ({ ...prev, new: !prev.new }))}
                aria-label={showPasswords.new ? 'Hide new password' : 'Show new password'}
              >
                {showPasswords.new ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
            {/* Password Strength Indicator - Visual Meter */}
            {passwords.new && (
              <div className="mt-2">
                <PasswordStrengthIndicator password={passwords.new} showCriteria={true} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwords.confirm}
                onChange={(e) => setPasswords((prev) => ({ ...prev, confirm: e.target.value }))}
                placeholder="Confirm new password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() =>
                  setShowPasswords((prev) => ({ ...prev, confirm: !prev.confirm }))
                }
                aria-label={
                  showPasswords.confirm
                    ? 'Hide confirmation password'
                    : 'Show confirmation password'
                }
              >
                {showPasswords.confirm ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <Button
            onClick={handlePasswordChange}
            disabled={passwordLoading || !isPasswordFormValid()}
            className="w-full sm:w-auto"
          >
            {passwordLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Change Password
          </Button>
        </div>
      </SettingsSection>

      {/* GDPR Data Export */}
      <SettingsSection
        title="Data Export"
        description="Download all your data in compliance with GDPR"
        kicker="Privacy"
      >
        <Button onClick={handleDataExport} disabled={exportLoading} variant="outline">
          {exportLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Request Data Export
        </Button>
        <p className="text-sm text-gray-500 mt-2">
          You'll receive an email with a download link when your data is ready
        </p>
      </SettingsSection>

      {/* GDPR Transparency */}
      <SettingsSection
        title="Transparencia GDPR"
        description="Información sobre el tratamiento automatizado de contenido"
        kicker="Privacy"
      >
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100">
                  Generación Automática de Contenido
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Los roasts autopublicados llevan firma de IA para cumplir con la normativa de
                  transparencia digital.
                </p>
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            <p>
              De acuerdo con el RGPD y las normativas de transparencia digital, todos los
              contenidos generados automáticamente por IA incluyen marcadores identificativos
              apropiados.
            </p>
          </div>
        </div>
      </SettingsSection>

      {/* Logout */}
      <SettingsSection
        title="Session Management"
        description="Manage your active session"
        kicker="Security"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Active Session</h4>
              <p className="text-sm text-gray-500">
                You are currently signed in as {user?.email || 'user'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await signOut();
                  navigate('/login');
                  showNotification('Logged out successfully', 'success');
                } catch (error) {
                  showNotification('Failed to logout', 'error');
                }
              }}
              className="flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* Account Deletion */}
      <SettingsSection
        title="Delete Account"
        description="Permanently delete your account and all associated data"
        kicker="Danger Zone"
        className="border-red-200"
      >
        <div className="space-y-4">
          {!showDeleteConfirm ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4" />
              Delete Account
            </Button>
          ) : (
            <div className="space-y-4 p-4 border border-red-200 rounded-lg bg-red-50">
              <p className="text-sm text-red-800 font-medium">
                ⚠️ This action cannot be undone. All your data will be permanently deleted.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">Type "DELETE" to confirm:</Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleAccountDeletion}
                  disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
                >
                  {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Delete Forever
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  );
};

AccountSettingsForm.displayName = 'AccountSettingsForm';

export default AccountSettingsForm;

