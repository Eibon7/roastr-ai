/**
 * AutoApprovalSettings Component
 * Issue #405 - Auto-approval flow UI implementation
 * 
 * Allows organizations to configure auto-approval and auto-publish settings
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Alert } from './ui/alert';
import { InfoTooltip } from './ui/InfoTooltip';
import { Shield, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabaseClient';

const AutoApprovalSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    auto_approval: false,
    auto_publish: false,
    shield_enabled: true,
    max_toxicity_score: 0.7,
    require_security_validation: true
  });
  const [planInfo, setPlanInfo] = useState({
    plan: 'free',
    autoApprovalAllowed: false
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get organization settings
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('id, plan, settings')
        .eq('id', user.organization_id)
        .single();

      if (orgError) throw orgError;

      // Determine if plan allows auto-approval
      const planAllowsAuto = ['starter', 'pro', 'plus'].includes(orgData.plan);
      
      setPlanInfo({
        plan: orgData.plan,
        autoApprovalAllowed: planAllowsAuto
      });

      if (orgData.settings) {
        setSettings({
          auto_approval: orgData.settings.auto_approval || false,
          auto_publish: orgData.settings.auto_publish || false,
          shield_enabled: orgData.settings.shield_enabled ?? true,
          max_toxicity_score: orgData.settings.max_toxicity_score || 0.7,
          require_security_validation: orgData.settings.require_security_validation ?? true
        });
      }
    } catch (error) {
      console.error('Error loading auto-approval settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load auto-approval settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    if (!user) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('organizations')
        .update({
          settings: newSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.organization_id);

      if (error) throw error;

      setSettings(newSettings);
      
      toast({
        title: 'Settings Updated',
        description: 'Auto-approval settings have been saved successfully',
        variant: 'success'
      });
    } catch (error) {
      console.error('Error updating auto-approval settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update auto-approval settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (field) => {
    const newSettings = { ...settings };
    
    if (field === 'auto_approval') {
      newSettings.auto_approval = !settings.auto_approval;
      // If disabling auto-approval, also disable auto-publish
      if (!newSettings.auto_approval) {
        newSettings.auto_publish = false;
      }
    } else if (field === 'auto_publish') {
      newSettings.auto_publish = !settings.auto_publish;
      // Auto-publish requires auto-approval
      if (newSettings.auto_publish && !settings.auto_approval) {
        newSettings.auto_approval = true;
      }
    } else {
      newSettings[field] = !settings[field];
    }

    updateSettings(newSettings);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-8 bg-gray-200 rounded w-full"></div>
            <div className="h-8 bg-gray-200 rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Auto-Approval Settings
            </CardTitle>
            <CardDescription>
              Configure automatic roast approval and publication
            </CardDescription>
          </div>
          <Badge variant={planInfo.autoApprovalAllowed ? 'default' : 'secondary'}>
            {planInfo.plan} Plan
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {!planInfo.autoApprovalAllowed && (
          <Alert variant="warning" className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Plan Limitation</p>
              <p className="text-sm text-gray-600 mt-1">
                Auto-approval is available for Starter, Pro, and Plus plans. 
                Upgrade to enable automatic roast processing.
              </p>
            </div>
          </Alert>
        )}

        {/* Auto-Approval Toggle */}
        <div className="flex items-start justify-between p-4 rounded-lg border bg-gray-50/50">
          <div className="flex-1">
            <Label htmlFor="auto-approval" className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Enable Auto-Approval
              <InfoTooltip content="Automatically approve roasts that pass security validations" />
            </Label>
            <p className="text-sm text-gray-600 mt-1">
              Generate and approve roasts without manual intervention
            </p>
          </div>
          <Switch
            id="auto-approval"
            checked={settings.auto_approval}
            onCheckedChange={() => handleToggle('auto_approval')}
            disabled={!planInfo.autoApprovalAllowed || saving}
          />
        </div>

        {/* Auto-Publish Toggle */}
        <div className="flex items-start justify-between p-4 rounded-lg border bg-gray-50/50">
          <div className="flex-1">
            <Label htmlFor="auto-publish" className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" />
              Enable Auto-Publish
              <InfoTooltip content="Automatically publish approved roasts to social media" />
            </Label>
            <p className="text-sm text-gray-600 mt-1">
              Publish approved roasts immediately without manual review
            </p>
          </div>
          <Switch
            id="auto-publish"
            checked={settings.auto_publish}
            onCheckedChange={() => handleToggle('auto_publish')}
            disabled={!planInfo.autoApprovalAllowed || !settings.auto_approval || saving}
          />
        </div>

        {/* Security Validation Toggle */}
        <div className="flex items-start justify-between p-4 rounded-lg border bg-gray-50/50">
          <div className="flex-1">
            <Label htmlFor="security-validation" className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-500" />
              Require Security Validation
              <InfoTooltip content="Enforce security checks before auto-approval" />
            </Label>
            <p className="text-sm text-gray-600 mt-1">
              All roasts must pass security validations (recommended)
            </p>
          </div>
          <Switch
            id="security-validation"
            checked={settings.require_security_validation}
            onCheckedChange={() => handleToggle('require_security_validation')}
            disabled={!settings.auto_approval || saving}
          />
        </div>

        {/* Rate Limits Info */}
        {settings.auto_approval && (
          <Alert className="mt-4">
            <Zap className="w-4 h-4" />
            <div className="ml-2">
              <p className="text-sm font-medium">Rate Limits</p>
              <p className="text-sm text-gray-600 mt-1">
                Auto-approval is limited to:
                <span className="font-medium"> 50 per hour</span> and
                <span className="font-medium"> 200 per day</span>
              </p>
            </div>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AutoApprovalSettings;