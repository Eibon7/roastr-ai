import React from 'react';
import PreferencesSettingsForm from '../../components/settings/PreferencesSettingsForm';

/**
 * PreferencesSettingsPage - Page component for preferences settings tab
 *
 * Route: /app/settings/preferences
 *
 * Displays Roastr persona settings, transparency copy, custom style prompt, and sponsor configuration.
 */
const PreferencesSettingsPage = () => {
  return <PreferencesSettingsForm />;
};

PreferencesSettingsPage.displayName = 'PreferencesSettingsPage';

export default PreferencesSettingsPage;
