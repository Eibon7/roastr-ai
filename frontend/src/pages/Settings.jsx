import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { 
  User, 
  Settings as SettingsIcon, 
  CreditCard, 
  Download, 
  Trash2, 
  Eye, 
  EyeOff, 
  Shield,
  Brain,
  Target,
  Zap,
  Crown,
  AlertTriangle,
  Loader2,
  Check
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import AjustesSettings from '../components/AjustesSettings';

const Settings = () => {
  const { userData: user } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(false);
  const [billingInfo, setBillingInfo] = useState(null);
  const [activeNotification, setActiveNotification] = useState(null);
  
  // Account tab states
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleNotification = (message, type = 'success') => {
    setActiveNotification({ message, type, id: Date.now() });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setActiveNotification(null);
    }, 5000);
  };

  const dismissNotification = () => {
    setActiveNotification(null);
  };

  useEffect(() => {
    loadBillingInfo();
  }, []);

  const loadBillingInfo = async () => {
    try {
      const billing = await apiClient.get('/billing/info');
      setBillingInfo(billing.data);
    } catch (error) {
      console.warn('Could not load billing info:', error);
    }
  };

  const handlePasswordChange = async () => {
    if (passwords.new !== passwords.confirm) {
      handleNotification('New passwords do not match', 'error');
      return;
    }
    
    if (passwords.new.length < 8) {
      handleNotification('Password must be at least 8 characters', 'error');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/auth/change-password', {
        currentPassword: passwords.current,
        newPassword: passwords.new
      });
      
      setPasswords({ current: '', new: '', confirm: '' });
      handleNotification('Password changed successfully', 'success');
    } catch (error) {
      handleNotification('Failed to change password', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDataExport = async () => {
    try {
      setLoading(true);
      await apiClient.post('/auth/export-data');
      handleNotification('Data export initiated. You will receive an email when ready.', 'success');
    } catch (error) {
      handleNotification('Failed to initiate data export', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountDeletion = async () => {
    if (deleteConfirmText !== 'DELETE') {
      handleNotification('Please type DELETE to confirm', 'error');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/auth/delete-account');
      handleNotification('Account deletion initiated', 'success');
      // Redirect to logout or landing page
      window.location.href = '/';
    } catch (error) {
      handleNotification('Failed to delete account', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getPlanColor = (plan) => {
    const colors = {
      free: 'bg-gray-100 text-gray-800',
      starter: 'bg-blue-100 text-blue-800',
      pro: 'bg-purple-100 text-purple-800',
      plus: 'bg-yellow-100 text-yellow-800'
    };
    return colors[plan?.toLowerCase()] || colors.free;
  };

  const getPlanIcon = (plan) => {
    switch (plan?.toLowerCase()) {
      case 'starter': return <Zap className="w-4 h-4" />;
      case 'pro': return <Target className="w-4 h-4" />;
      case 'plus': return <Crown className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  if (loading && !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Notification */}
      {activeNotification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg border ${
          activeNotification.type === 'error' 
            ? 'bg-red-50 border-red-200 text-red-800' 
            : activeNotification.type === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-green-50 border-green-200 text-green-800'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{activeNotification.message}</span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={dismissNotification}
              className="ml-2 h-4 w-4 p-0"
            >
              ×
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-8 h-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account, preferences, and billing</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Account
          </TabsTrigger>
          <TabsTrigger value="adjustments" className="flex items-center gap-2">
            <Brain className="w-4 h-4" />
            Adjustments
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Billing
          </TabsTrigger>
        </TabsList>

        {/* Account Tab */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Account Information
              </CardTitle>
              <CardDescription>
                Manage your account details and security settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
                <p className="text-sm text-gray-500">
                  Email changes require contacting support
                </p>
              </div>

              {/* Password Change */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Change Password</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showPasswords.current ? "text" : "password"}
                      value={passwords.current}
                      onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                      placeholder="Enter current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                    >
                      {showPasswords.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPasswords.new ? "text" : "password"}
                      value={passwords.new}
                      onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                      placeholder="Enter new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    >
                      {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showPasswords.confirm ? "text" : "password"}
                      value={passwords.confirm}
                      onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                      placeholder="Confirm new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    >
                      {showPasswords.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <Button 
                  onClick={handlePasswordChange}
                  disabled={loading || !passwords.current || !passwords.new || !passwords.confirm}
                  className="w-full sm:w-auto"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* GDPR Data Export */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Data Export
              </CardTitle>
              <CardDescription>
                Download all your data in compliance with GDPR
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleDataExport} disabled={loading} variant="outline">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Request Data Export
              </Button>
              <p className="text-sm text-gray-500 mt-2">
                You'll receive an email with a download link when your data is ready
              </p>
            </CardContent>
          </Card>

          {/* Account Deletion */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Delete Account
              </CardTitle>
              <CardDescription>
                Permanently delete your account and all associated data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                      disabled={loading || deleteConfirmText !== 'DELETE'}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Adjustments Tab - Use existing AjustesSettings component */}
        <TabsContent value="adjustments" className="space-y-6">
          <AjustesSettings 
            user={user} 
            onNotification={handleNotification}
          />
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Current Plan
              </CardTitle>
              <CardDescription>
                Your subscription and usage overview
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {billingInfo ? (
                <>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getPlanIcon(user?.plan || 'free')}
                      <div>
                        <h3 className="font-semibold capitalize">{user?.plan || 'Free'} Plan</h3>
                        <p className="text-sm text-gray-600">
                          {user?.plan === 'free' ? 'Free' : user?.plan === 'starter' ? '€5/month' : user?.plan === 'pro' ? '€15/month' : '€50/month'}
                        </p>
                      </div>
                    </div>
                    <Badge className={getPlanColor(user?.plan || 'free')}>
                      Active
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium text-sm text-gray-600">Roasts Generated</h4>
                      <p className="text-2xl font-bold">
                        {Math.floor(Math.random() * 50)}
                        <span className="text-sm text-gray-500 font-normal">
                          /{user?.plan === 'free' ? '5' : user?.plan === 'starter' ? '50' : user?.plan === 'pro' ? '200' : '∞'}
                        </span>
                      </p>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium text-sm text-gray-600">API Calls</h4>
                      <p className="text-2xl font-bold">
                        {Math.floor(Math.random() * 100)}
                        <span className="text-sm text-gray-500 font-normal">
                          /{user?.plan === 'free' ? '10' : user?.plan === 'starter' ? '100' : user?.plan === 'pro' ? '500' : '∞'}
                        </span>
                      </p>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium text-sm text-gray-600">This Month</h4>
                      <p className="text-2xl font-bold">
                        €{user?.plan === 'free' ? '0.00' : user?.plan === 'starter' ? '5.00' : user?.plan === 'pro' ? '15.00' : '50.00'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => window.location.href = '/billing'}>
                      View Full Billing
                    </Button>
                    {user?.plan === 'free' && (
                      <Button className="flex-1" onClick={() => window.location.href = '/pricing'}>
                        Upgrade Plan
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Loading billing information...</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Plan Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Available Plans</CardTitle>
              <CardDescription>
                Choose the plan that fits your needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { name: 'Free', price: '€0', features: ['5 roasts/day', 'Basic AI'] },
                  { name: 'Starter', price: '€5', features: ['50 roasts/day', 'Enhanced AI', '2 platforms'] },
                  { name: 'Pro', price: '€15', features: ['200 roasts/day', 'Premium AI', '5 platforms'] },
                  { name: 'Plus', price: '€50', features: ['Unlimited roasts', 'Custom AI', 'All platforms'] }
                ].map((plan) => (
                  <div 
                    key={plan.name} 
                    className={`p-4 border rounded-lg ${
                      (user?.plan?.toLowerCase() || 'free') === plan.name.toLowerCase() 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200'
                    }`}
                  >
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="text-2xl font-bold text-blue-600">{plan.price}</p>
                    <ul className="text-sm text-gray-600 mt-2 space-y-1">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-1">
                          <Check className="w-3 h-3 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {(user?.plan?.toLowerCase() || 'free') === plan.name.toLowerCase() ? (
                      <Badge className="mt-2 w-full justify-center">Current</Badge>
                    ) : (
                      <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => window.location.href = '/pricing'}>
                        {plan.name === 'Free' ? 'Downgrade' : 'Upgrade'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;