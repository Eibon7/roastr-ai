/**
 * AccountSettingsDialog Component
 *
 * Dialog for managing account settings (auto-approve, Shield, tone, status)
 * Extracted from AccountModal for reuse in AccountDetailPage
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from './ui/dialog';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { SHIELD_LEVELS, TONE_OPTIONS, TONE_EXAMPLES } from '../mocks/social';
import { TONE_DEFINITIONS } from '../config/tones';
import { Trash2, Settings } from 'lucide-react';
import logger from '../utils/logger';

const AccountSettingsDialog = ({
  account,
  accountDetails,
  onToggleAutoApprove,
  onToggleAccount,
  onChangeShieldLevel,
  onToggleShield,
  onChangeTone,
  onDisconnectAccount,
  onClose,
  trigger
}) => {
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});
  const [dialogOpen, setDialogOpen] = useState(false);

  // Reset disconnect confirmation when dialog closes
  useEffect(() => {
    if (!dialogOpen) {
      setShowDisconnectConfirm(false);
    }
  }, [dialogOpen]);

  const isActive = accountDetails?.status === 'active' || account?.status === 'active';
  const autoApprove = accountDetails?.settings?.autoApprove || false;
  const shieldEnabled = accountDetails?.settings?.shieldEnabled || false;
  const shieldLevel = accountDetails?.settings?.shieldLevel || 50;
  const defaultTone = accountDetails?.settings?.defaultTone || 'Balanceado';

  // Handle async actions with loading states
  const handleAsyncAction = useCallback(
    async (actionKey, actionFn, successMessage) => {
      setLoadingStates((prev) => ({ ...prev, [actionKey]: true }));
      try {
        await actionFn();
        if (successMessage) {
          logger.info(successMessage, { actionKey });
        }
      } catch (error) {
        logger.error(`Error in ${actionKey}`, error, { actionKey });
      } finally {
        setLoadingStates((prev) => ({ ...prev, [actionKey]: false }));
      }
    },
    []
  );

  const handleToggleAutoApprove = () => {
    handleAsyncAction(
      'toggle-auto-approve',
      async () => {
        await onToggleAutoApprove(account.platform || account.id, !autoApprove);
      },
      'Configuración de auto-aprobación actualizada'
    );
  };

  const handleToggleShield = () => {
    handleAsyncAction(
      'toggle-shield',
      async () => {
        await onToggleShield(account.platform || account.id, !shieldEnabled);
      },
      'Configuración de Shield actualizada'
    );
  };

  const handleChangeShieldLevel = (value) => {
    handleAsyncAction(
      'change-shield-level',
      async () => {
        await onChangeShieldLevel(account.platform || account.id, parseInt(value));
      },
      'Nivel de Shield actualizado'
    );
  };

  const handleChangeTone = (value) => {
    handleAsyncAction(
      'change-tone',
      async () => {
        await onChangeTone(account.platform || account.id, value);
      },
      'Tono por defecto actualizado'
    );
  };

  const handleToggleAccount = () => {
    handleAsyncAction(
      'toggle-account',
      async () => {
        await onToggleAccount(account.platform || account.id, !isActive);
      },
      `Cuenta ${!isActive ? 'activada' : 'pausada'}`
    );
  };

  const handleDisconnect = () => {
    handleAsyncAction(
      'disconnect',
      async () => {
        await onDisconnectAccount(account.id);
        setShowDisconnectConfirm(false);
        setDialogOpen(false);
        if (onClose) onClose();
      },
      'Cuenta desconectada correctamente'
    );
  };

  const toneExample = TONE_EXAMPLES[defaultTone] || TONE_DEFINITIONS.BALANCEADO?.example;

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Configuración
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuración de cuenta</DialogTitle>
        </DialogHeader>

        <div className="space-y-8 py-4">
          {/* Auto Approval */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Aprobación automática</Label>
                <p className="text-sm text-muted-foreground">
                  Los roasts se publican automáticamente sin revisión manual
                </p>
              </div>
              <Switch
                checked={autoApprove}
                onCheckedChange={handleToggleAutoApprove}
                disabled={loadingStates['toggle-auto-approve']}
                aria-label="Toggle auto-approve"
              />
            </div>
          </div>

          {/* Shield Toggle */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1">
                <Label className="text-base font-medium">Roastr Shield</Label>
                <p className="text-sm text-muted-foreground">
                  Protección automática contra comentarios tóxicos
                </p>
              </div>
              <Switch
                checked={shieldEnabled}
                onCheckedChange={handleToggleShield}
                disabled={loadingStates['toggle-shield']}
                aria-label="Toggle Shield"
              />
            </div>

            {/* Shield Level Dropdown */}
            {shieldEnabled && (
              <div className="space-y-2">
                <Label>Nivel de protección</Label>
                <Select
                  value={shieldLevel.toString()}
                  onValueChange={handleChangeShieldLevel}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIELD_LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value.toString()}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Default Tone */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="space-y-2 mb-4">
              <Label className="text-base font-medium">Tono del roast por defecto</Label>
              <Select value={defaultTone} onValueChange={handleChangeTone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {tone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tone Preview */}
            {toneExample && (
              <Alert>
                <AlertDescription>
                  <p className="text-sm font-medium mb-1">
                    Ejemplo de roast {defaultTone.toLowerCase()}:
                  </p>
                  <p className="text-sm italic">{toneExample}</p>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Account Status Toggle */}
          <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Estado de la cuenta</Label>
                <p className="text-sm text-muted-foreground">
                  {isActive
                    ? 'La cuenta está activa y generando roasts'
                    : 'La cuenta está pausada'}
                </p>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={handleToggleAccount}
                disabled={loadingStates['toggle-account']}
                aria-label="Toggle account status"
              />
            </div>
          </div>

          {/* Danger Zone */}
          <div className="pt-6">
            <div className="space-y-4">
              <div>
                <h4 className="text-base font-medium text-destructive mb-2">Zona de peligro</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Al desconectar la cuenta, se perderá el acceso a todos los datos asociados.
                </p>
              </div>

              {!showDisconnectConfirm ? (
                <Button
                  variant="destructive"
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Desconectar cuenta
                </Button>
              ) : (
                <div className="space-y-2">
                  <Alert variant="destructive">
                    <AlertDescription>
                      ¿Estás seguro de que quieres desconectar esta cuenta? Esta acción no se puede
                      deshacer.
                    </AlertDescription>
                  </Alert>
                  <div className="flex space-x-2">
                    <Button
                      variant="destructive"
                      onClick={handleDisconnect}
                      disabled={loadingStates['disconnect']}
                      className="flex-1"
                    >
                      {loadingStates['disconnect'] ? 'Desconectando...' : 'Sí, desconectar'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowDisconnectConfirm(false)}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AccountSettingsDialog;

