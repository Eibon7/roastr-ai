/**
 * System Control Panel
 * Issue #294: Kill Switch global y panel de control de feature flags para administradores
 * 
 * Dedicated admin page for kill switch and feature flags management
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  ArrowLeft,
  Power, 
  Settings, 
  FileText,
  Activity,
  AlertTriangle,
  Shield,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { authHelpers } from '../../lib/supabaseClient';
import KillSwitchPanel from '../../components/admin/KillSwitchPanel';
import FeatureFlagsPanel from '../../components/admin/FeatureFlagsPanel';
import AuditLogsPanel from '../../components/admin/AuditLogsPanel';
import { adminApi } from '../../services/adminApi';

const SystemControlPanel = () => {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [activeTab, setActiveTab] = useState('kill-switch');
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  useEffect(() => {
    checkAdminAndLoadData();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      if (!mountedRef.current) return;
      setLoading(true);

      // Check admin access
      const session = await authHelpers.getCurrentSession();
      if (!mountedRef.current) return;

      if (!session?.access_token) {
        toast.error('Authentication required', {
          description: 'Please log in to access the admin panel'
        });
        navigate('/login');
        return;
      }

      const userData = await authHelpers.getUserFromAPI(session.access_token);
      if (!mountedRef.current) return;

      if (!userData.is_admin) {
        toast.error('Access denied', {
          description: 'You do not have administrator privileges'
        });
        navigate('/dashboard');
        return;
      }

      if (mountedRef.current) {
        setCurrentUser(userData);
      }

      // Load system status
      try {
        const statusResponse = await adminApi.getSystemStatus();
        if (mountedRef.current) {
          setSystemStatus(statusResponse.data);
        }
      } catch (error) {
        console.warn('Could not load system status:', error);
        if (mountedRef.current) {
          toast.error('Failed to load system status', {
            description: error.message || 'Unable to retrieve current system health information'
          });
        }
      }

    } catch (error) {
      console.error('Admin check error:', error);
      if (mountedRef.current) {
        toast.error('Failed to load system status', {
          description: error.message || 'Unable to verify administrator access'
        });
        navigate('/dashboard');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleBackToDashboard = () => {
    navigate('/admin');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                onClick={handleBackToDashboard}
                variant="ghost"
                size="sm"
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Admin Dashboard
              </Button>
              <div className="h-6 w-px bg-gray-300" />
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-blue-600" />
                <h1 className="text-xl font-semibold text-gray-900">
                  System Control Panel
                </h1>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {systemStatus && (
                <Badge 
                  variant={systemStatus.healthy ? 'success' : 'destructive'}
                  className="flex items-center gap-1"
                >
                  <Activity className="h-3 w-3" />
                  {systemStatus.healthy ? 'System Healthy' : 'System Issues'}
                </Badge>
              )}
              <span className="text-sm text-gray-600">
                Admin: {currentUser?.email}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* System Status Alert */}
        {systemStatus && !systemStatus.healthy && (
          <div className="mb-6">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <div>
                    <h3 className="font-medium text-red-800">System Health Alert</h3>
                    <p className="text-sm text-red-700 mt-1">
                      {systemStatus.issues?.join(', ') || 'System is experiencing issues'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Control Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="kill-switch" className="flex items-center gap-2">
              <Power className="h-4 w-4" />
              Kill Switch
            </TabsTrigger>
            <TabsTrigger value="feature-flags" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Feature Flags
            </TabsTrigger>
            <TabsTrigger value="audit-logs" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Audit Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="kill-switch" className="space-y-6">
            <div className="grid gap-6">
              <KillSwitchPanel />
              
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('feature-flags')}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Manage Feature Flags
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('audit-logs')}
                      className="flex items-center gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      View Audit Logs
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => navigate('/admin')}
                      className="flex items-center gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="feature-flags" className="space-y-6">
            <FeatureFlagsPanel />
          </TabsContent>

          <TabsContent value="audit-logs" className="space-y-6">
            <AuditLogsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SystemControlPanel;
