import React from 'react';
import AjustesSettings from '../AjustesSettings';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

/**
 * PreferencesSettingsForm - Form component for preferences settings
 *
 * Displays:
 * - Roastr persona fields (bio, tono, preferencias)
 * - Transparency copy
 * - Custom style prompt (Pro/Plus only with feature flag)
 * - Sponsor configuration (Plus only)
 *
 * Issue #1055: Implementar tab de Ajustes (/app/settings/preferences)
 */
const PreferencesSettingsForm = () => {
  const { userData: user } = useAuth();

  const handleNotification = (message, type = 'success') => {
    if (type === 'success') {
      toast.success(message);
    } else if (type === 'error') {
      toast.error(message);
    } else {
      toast.info(message);
    }
  };

  return (
    <div className="space-y-6">
      <AjustesSettings user={user} onNotification={handleNotification} />
    </div>
  );
};

PreferencesSettingsForm.displayName = 'PreferencesSettingsForm';

export default PreferencesSettingsForm;
