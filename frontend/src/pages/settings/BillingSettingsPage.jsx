import React from 'react';
import BillingPanel from '../../components/settings/BillingPanel';

/**
 * BillingSettingsPage - Page component for billing settings tab
 * 
 * Route: /app/settings/billing
 * 
 * Displays payment method, plan information, next billing date, upgrade and cancellation options.
 */
const BillingSettingsPage = () => {
  return <BillingPanel />;
};

BillingSettingsPage.displayName = 'BillingSettingsPage';

export default BillingSettingsPage;

