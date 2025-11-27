import React, { useEffect } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Settings as SettingsIcon, User, Brain, CreditCard } from 'lucide-react';
import { TabsContent } from '../ui/tabs';

/**
 * SettingsLayout - Layout component with tabs synchronized with URL
 * 
 * Manages navigation between settings tabs:
 * - /app/settings/account
 * - /app/settings/preferences
 * - /app/settings/billing
 * 
 * Tabs are synchronized with the current URL path.
 */
const SettingsLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract active tab from URL path
  const getActiveTab = () => {
    const pathParts = location.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    
    // Default to 'account' if path is just '/app/settings'
    if (lastPart === 'settings' || !lastPart) {
      return 'account';
    }
    
    return lastPart;
  };

  const activeTab = getActiveTab();

  // Handle tab change - navigate to corresponding route
  const handleTabChange = (value) => {
    navigate(`/app/settings/${value}`);
  };

  // Redirect /app/settings to /app/settings/account
  useEffect(() => {
    if (location.pathname === '/app/settings') {
      navigate('/app/settings/account', { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account, preferences, and billing</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Preferences
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Billing
          </TabsTrigger>
        </TabsList>

        {/* Render child routes based on active tab */}
        <TabsContent value={activeTab} className="mt-6">
          <Outlet />
        </TabsContent>
      </Tabs>
    </div>
  );
};

SettingsLayout.displayName = 'SettingsLayout';

export default SettingsLayout;

