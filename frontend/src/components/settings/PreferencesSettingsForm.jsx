import React from 'react';
import AjustesSettings from '../AjustesSettings';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';

/**
 * PreferencesSettingsForm - Form component for preferences settings
 * 
 * Wraps AjustesSettings component which includes:
 * 
 * ✅ Roastr persona fields:
 *    - "Lo que me define" (identity/bio field)
 *    - "Lo que no tolero" (intolerance field)
 *    - "Lo que me da igual" (tolerance field)
 *    All with visibility toggles and validation
 * 
 * ✅ Transparency copy:
 *    - TransparencySettings component with GDPR compliance messaging
 *    - Bio text generation with sensitive data detection
 *    - Copy to clipboard functionality
 * 
 * ✅ Custom style prompt (StyleSelector):
 *    - StyleSelector component (line 789 in AjustesSettings.jsx)
 *    - Gating: Pro/Plus plans + feature flag (checked in StyleSelector)
 *    - See StyleSelector.jsx for plan-based access control
 * 
 * ✅ Sponsor configuration:
 *    - Note: Sponsor functionality may be in separate component
 *    - Check user.plan === 'plus' for Plus-only features
 *    - See AjustesSettings.jsx for plan-based gating logic
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


