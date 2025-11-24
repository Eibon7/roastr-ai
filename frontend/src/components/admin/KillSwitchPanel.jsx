/**
 * Kill Switch Panel Component
 * Issue #294: Kill Switch global y panel de control de feature flags para administradores
 *
 * Provides emergency kill switch controls for administrators
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { AlertTriangle, Power, Shield, Clock, User, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../../services/adminApi';

const KillSwitchPanel = () => {
  const [killSwitchEnabled, setKillSwitchEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingState, setPendingState] = useState(false);
  const [reason, setReason] = useState('');

  // Focus management refs
  const triggerElementRef = useRef(null);
  const modalRef = useRef(null);
  const firstFocusableRef = useRef(null);
  const lastFocusableRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    loadKillSwitchStatus();
  }, []);

  // Focus management and keyboard handling for modal
  useEffect(() => {
    if (!showConfirmDialog) return;

    // Set initial focus to Cancel button
    if (firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }

    // Store the trigger element for focus restoration
    triggerElementRef.current = document.activeElement;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelToggle();
        return;
      }

      if (e.key === 'Enter' && !textareaRef.current?.contains(e.target)) {
        e.preventDefault();
        confirmToggle();
        return;
      }

      // Focus trap logic
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        if (!focusableElements?.length) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus to trigger element when modal closes
      if (triggerElementRef.current) {
        triggerElementRef.current.focus();
      }
    };
  }, [showConfirmDialog]);

  const loadKillSwitchStatus = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getFeatureFlags();

      const killSwitchFlag = response.data.flags.find(
        (flag) => flag.flag_key === 'KILL_SWITCH_AUTOPOST'
      );

      if (killSwitchFlag) {
        setKillSwitchEnabled(killSwitchFlag.is_enabled);
        setLastUpdate(killSwitchFlag.updated_at);
      }
    } catch (error) {
      console.error('Failed to load kill switch status:', error);
      toast.error('Failed to load kill switch status');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRequest = (newState) => {
    // Store the current active element (the switch) for focus restoration
    triggerElementRef.current = document.activeElement;
    setPendingState(newState);
    setShowConfirmDialog(true);
  };

  const confirmToggle = async () => {
    try {
      setToggling(true);
      setShowConfirmDialog(false);

      await adminApi.toggleKillSwitch(pendingState, reason);

      setKillSwitchEnabled(pendingState);
      setLastUpdate(new Date().toISOString());
      setReason('');

      toast.success(`Kill switch ${pendingState ? 'activated' : 'deactivated'} successfully`, {
        description: pendingState
          ? 'All autopost operations are now blocked'
          : 'Autopost operations are now allowed'
      });
    } catch (error) {
      console.error('Failed to toggle kill switch:', error);
      toast.error('Failed to toggle kill switch');
    } finally {
      setToggling(false);
    }
  };

  const cancelToggle = () => {
    setShowConfirmDialog(false);
    setPendingState(false);
    setReason('');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" />
            Kill Switch
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className={`border-2 ${killSwitchEnabled ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Power
                className={`h-5 w-5 ${killSwitchEnabled ? 'text-red-600' : 'text-green-600'}`}
              />
              Emergency Kill Switch
            </div>
            <Badge
              variant={killSwitchEnabled ? 'destructive' : 'success'}
              className="text-sm font-semibold"
            >
              {killSwitchEnabled ? 'ACTIVE' : 'INACTIVE'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {killSwitchEnabled && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Kill switch is ACTIVE!</strong> All autopost operations are currently
                blocked.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
            <div className="space-y-1">
              <h3 className="font-medium">Global Autopost Control</h3>
              <p className="text-sm text-gray-600">
                {killSwitchEnabled
                  ? 'Autopost is completely disabled across all platforms'
                  : 'Autopost is enabled and operating normally'}
              </p>
            </div>
            <Switch
              checked={killSwitchEnabled}
              onCheckedChange={handleToggleRequest}
              disabled={toggling}
              className="data-[state=checked]:bg-red-600"
            />
          </div>

          {lastUpdate && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              Last updated: {new Date(lastUpdate).toLocaleString()}
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Shield className="h-4 w-4" />
            This control affects all users and platforms immediately
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      {showConfirmDialog &&
        createPortal(
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                cancelToggle();
              }
            }}
          >
            <div
              ref={modalRef}
              className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              aria-describedby="modal-description"
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle
                  className={`h-6 w-6 ${pendingState ? 'text-red-600' : 'text-green-600'}`}
                />
                <h3 id="modal-title" className="text-lg font-semibold">
                  {pendingState ? 'Activate Kill Switch' : 'Deactivate Kill Switch'}
                </h3>
              </div>

              <div className="space-y-4">
                <p id="modal-description" className="text-gray-700">
                  {pendingState
                    ? 'This will immediately stop ALL autopost operations across all platforms and users. Use only in emergencies.'
                    : 'This will re-enable autopost operations. Make sure the issue has been resolved.'}
                </p>

                <div>
                  <label
                    htmlFor="reason-textarea"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Reason (optional)
                  </label>
                  <textarea
                    id="reason-textarea"
                    ref={textareaRef}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={
                      pendingState
                        ? 'Why are you activating the kill switch?'
                        : 'Why are you deactivating the kill switch?'
                    }
                    className="w-full p-2 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  ref={firstFocusableRef}
                  onClick={cancelToggle}
                  variant="outline"
                  className="flex-1"
                  tabIndex={0}
                >
                  Cancel
                </Button>
                <Button
                  ref={lastFocusableRef}
                  onClick={confirmToggle}
                  variant={pendingState ? 'destructive' : 'default'}
                  className="flex-1"
                  disabled={toggling}
                  tabIndex={0}
                >
                  {toggling ? 'Processing...' : 'Confirm'}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default KillSwitchPanel;
