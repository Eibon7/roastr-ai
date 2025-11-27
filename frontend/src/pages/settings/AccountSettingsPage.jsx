import React from 'react';
import AccountSettingsForm from '../../components/settings/AccountSettingsForm';

/**
 * AccountSettingsPage - Page component for account settings tab
 *
 * Route: /app/settings/account
 *
 * Displays account information, password change, GDPR export, and account deletion.
 */
const AccountSettingsPage = () => {
  return <AccountSettingsForm />;
};

AccountSettingsPage.displayName = 'AccountSettingsPage';

export default AccountSettingsPage;
