/**
 * AccountDetailPage Component
 *
 * Full page view for account detail with settings, roasts table, and Shield accordion
 * Replaces AccountModal with a dedicated route /app/accounts/:id
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table';
import { ArrowLeft } from 'lucide-react';
import ShieldInterceptedList from '../components/ShieldInterceptedList';
import AccountSettingsDialog from '../components/AccountSettingsDialog';
import { useSocialAccounts } from '../hooks/useSocialAccounts';
import { useFeatureFlags } from '../hooks/useFeatureFlags';
import { NETWORK_ICONS, NETWORK_COLORS } from '../mocks/social';
import PageLayout from '../components/roastr/PageLayout';

const AccountDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isEnabled } = useFeatureFlags();
  const enableShield = isEnabled('ENABLE_SHIELD_UI');

  const {
    getAccountById,
    roastsByAccount,
    interceptedByAccount,
    onApproveRoast,
    onRejectRoast,
    onToggleAutoApprove,
    onToggleAccount,
    onChangeShieldLevel,
    onToggleShield,
    onChangeTone,
    onDisconnectAccount
  } = useSocialAccounts();

  const [accountDetails, setAccountDetails] = useState(null);
  const [roasts, setRoasts] = useState([]);
  const [intercepted, setIntercepted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shieldLoading, setShieldLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});

  const account = getAccountById(id);
  const networkIcon = account ? NETWORK_ICONS[account.network || account.platform] || '📱' : '📱';
  const networkColor = account
    ? NETWORK_COLORS[account.network || account.platform] || 'bg-gray-600 text-white'
    : 'bg-gray-600 text-white';
  const isActive = accountDetails?.status === 'active' || account?.status === 'active';

  // Fetch account data
  useEffect(() => {
    const fetchAccountData = async () => {
      if (!account) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const token = localStorage.getItem('token');

        // Fetch account details
        const detailsResponse = await fetch(
          `/api/user/accounts/${account.platform || account.id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json();
          setAccountDetails(detailsData.data);
        }

        // Fetch recent roasts
        const roastsResponse = await fetch(
          `/api/user/accounts/${account.platform || account.id}/roasts?limit=50`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (roastsResponse.ok) {
          const roastsData = await roastsResponse.json();
          setRoasts(roastsData.data || []);
        } else {
          // Fallback to mock data
          setRoasts(roastsByAccount(id) || []);
        }

        // Fetch Shield events
        if (enableShield) {
          await fetchShieldEvents();
        }
      } catch (error) {
        console.error('Error fetching account data:', error);
        // Fallback to mock data
        setRoasts(roastsByAccount(id) || []);
        setIntercepted(interceptedByAccount(id) || []);
      } finally {
        setLoading(false);
      }
    };

    fetchAccountData();
  }, [id, account, roastsByAccount, interceptedByAccount, enableShield]);

  // Fetch Shield events
  const fetchShieldEvents = async () => {
    try {
      const token = localStorage.getItem('token');
      const platform = account?.platform || account?.network || accountDetails?.platform;

      const params = new URLSearchParams({
        timeRange: '30d',
        limit: '50'
      });

      if (platform && platform !== 'undefined') {
        params.append('platform', platform);
      }

      const shieldResponse = await fetch(`/api/shield/events?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (shieldResponse.ok) {
        const shieldData = await shieldResponse.json();
        setIntercepted(shieldData.data?.events || []);
      } else {
        setIntercepted(interceptedByAccount(id) || []);
      }
    } catch (error) {
      console.error('Error fetching Shield events:', error);
      setIntercepted(interceptedByAccount(id) || []);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRoastCount = (count) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  // Handle async actions with loading states
  const handleAsyncAction = useCallback(async (actionKey, actionFn, successMessage) => {
    setLoadingStates((prev) => ({ ...prev, [actionKey]: true }));
    try {
      await actionFn();
      if (successMessage) {
        // Could show toast here
        console.log(successMessage);
      }
    } catch (error) {
      console.error(`Error in ${actionKey}:`, error);
      // Could show error toast here
    } finally {
      setLoadingStates((prev) => ({ ...prev, [actionKey]: false }));
    }
  }, []);

  const handleApproveRoast = useCallback(
    (roastId) => {
      handleAsyncAction(
        `approve-${roastId}`,
        async () => {
          await onApproveRoast(id, roastId);
          // Refresh roasts
          const roastsData = roastsByAccount(id) || [];
          setRoasts(roastsData);
        },
        'Roast aprobado correctamente'
      );
    },
    [id, onApproveRoast, roastsByAccount, handleAsyncAction]
  );

  const handleRejectRoast = useCallback(
    (roastId) => {
      handleAsyncAction(
        `reject-${roastId}`,
        async () => {
          await onRejectRoast(id, roastId);
          // Refresh roasts
          const roastsData = roastsByAccount(id) || [];
          setRoasts(roastsData);
        },
        'Roast rechazado correctamente'
      );
    },
    [id, onRejectRoast, roastsByAccount, handleAsyncAction]
  );

  const handleRefreshShieldEvents = async () => {
    setShieldLoading(true);
    try {
      await fetchShieldEvents();
    } catch (error) {
      console.error('Failed to refresh Shield events:', error);
    } finally {
      setShieldLoading(false);
    }
  };

  const handleRevertShieldAction = async (actionId, reason = '') => {
    const response = await fetch(`/api/shield/revert/${actionId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Failed to revert Shield action');
    }

    await fetchShieldEvents();
    return response.json();
  };

  if (loading) {
    return (
      <PageLayout title="Detalle de cuenta" subtitle="Cargando información de la cuenta...">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    );
  }

  if (!account) {
    return (
      <PageLayout title="Cuenta no encontrada" subtitle="La cuenta solicitada no existe">
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            No se encontró la cuenta con ID: {id}
          </p>
          <Button onClick={() => navigate('/app/accounts')}>Volver a cuentas</Button>
        </div>
      </PageLayout>
    );
  }

  const displayName =
    accountDetails?.handle || account.handle || account.username || `@${account.platform}_user`;

  return (
    <PageLayout
      title={displayName}
      subtitle={`Gestión de cuenta ${account.platform === 'twitter' ? 'X / Twitter' : account.platform}`}
    >
      <div className="space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate('/app/accounts')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a cuentas
        </Button>

        {/* Header with Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Account Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cuenta</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div
                  className={`w-12 h-12 rounded-lg ${networkColor} flex items-center justify-center text-2xl font-bold`}
                >
                  {networkIcon}
                </div>
                <div>
                  <p className="font-semibold text-lg">{displayName}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant={isActive ? 'success' : 'destructive'}>
                      {isActive ? 'Activa' : 'Inactiva'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Total Roasts Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Roasts este mes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatRoastCount(accountDetails?.monthlyRoasts || account.monthlyRoasts || 0)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Total generados</p>
            </CardContent>
          </Card>

          {/* Shield Intercepted Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Shield interceptados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{intercepted.length}</div>
              <p className="text-sm text-muted-foreground mt-1">Comentarios bloqueados</p>
            </CardContent>
          </Card>
        </div>

        {/* Settings Button */}
        <div className="flex justify-end mb-4">
          <AccountSettingsDialog
            account={account}
            accountDetails={accountDetails}
            onToggleAutoApprove={onToggleAutoApprove}
            onToggleAccount={onToggleAccount}
            onChangeShieldLevel={onChangeShieldLevel}
            onToggleShield={onToggleShield}
            onChangeTone={onChangeTone}
            onDisconnectAccount={onDisconnectAccount}
            onClose={() => {
              // Refresh account details after settings change
              window.location.reload();
            }}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="roasts" className="w-full">
          <TabsList>
            <TabsTrigger value="roasts">💬 Roasts</TabsTrigger>
            {enableShield && <TabsTrigger value="shield">🛡️ Shield</TabsTrigger>}
          </TabsList>

          {/* Roasts Tab */}
          <TabsContent value="roasts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Últimos roasts generados</CardTitle>
              </CardHeader>
              <CardContent>
                {roasts.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-400 dark:text-gray-500 text-4xl mb-2">💬</div>
                    <p className="text-gray-500 dark:text-gray-400">No hay roasts generados aún</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Comentario original</TableHead>
                            <TableHead>Roast generado</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {roasts.map((roast) => (
                            <TableRow key={roast.id}>
                              <TableCell className="max-w-md">
                                <p className="text-sm">"{roast.original || roast.original_text}"</p>
                              </TableCell>
                              <TableCell className="max-w-md">
                                <p className="text-sm">"{roast.roast || roast.response_text}"</p>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(roast.createdAt || roast.created_at)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    roast.status === 'approved'
                                      ? 'success'
                                      : roast.status === 'rejected'
                                        ? 'destructive'
                                        : 'secondary'
                                  }
                                >
                                  {roast.status === 'approved'
                                    ? 'Aprobado'
                                    : roast.status === 'rejected'
                                      ? 'Rechazado'
                                      : 'Pendiente'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end space-x-2">
                                  {/* Approval buttons - only show if auto-approve is OFF and status is pending */}
                                  {!(accountDetails?.settings?.autoApprove || false) &&
                                    roast.status === 'pending' && (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleRejectRoast(roast.id)}
                                          disabled={loadingStates[`reject-${roast.id}`]}
                                        >
                                          {loadingStates[`reject-${roast.id}`] ? '⏳' : '❌'}{' '}
                                          Rechazar
                                        </Button>
                                        <Button
                                          variant="default"
                                          size="sm"
                                          onClick={() => handleApproveRoast(roast.id)}
                                          disabled={loadingStates[`approve-${roast.id}`]}
                                        >
                                          {loadingStates[`approve-${roast.id}`] ? '⏳' : '✅'}{' '}
                                          Aprobar
                                        </Button>
                                      </>
                                    )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                      {roasts.map((roast) => (
                        <Card key={roast.id}>
                          <CardContent className="p-4 space-y-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                Comentario original
                              </p>
                              <p className="text-sm">"{roast.original || roast.original_text}"</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Roast generado</p>
                              <p className="text-sm">"{roast.roast || roast.response_text}"</p>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t">
                              <div className="flex items-center space-x-2">
                                <Badge
                                  variant={
                                    roast.status === 'approved'
                                      ? 'success'
                                      : roast.status === 'rejected'
                                        ? 'destructive'
                                        : 'secondary'
                                  }
                                >
                                  {roast.status === 'approved'
                                    ? 'Aprobado'
                                    : roast.status === 'rejected'
                                      ? 'Rechazado'
                                      : 'Pendiente'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(roast.createdAt || roast.created_at)}
                                </span>
                              </div>
                            </div>
                            {/* Approval buttons - only show if auto-approve is OFF and status is pending */}
                            {!(accountDetails?.settings?.autoApprove || false) &&
                              roast.status === 'pending' && (
                                <div className="flex space-x-2 pt-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRejectRoast(roast.id)}
                                    disabled={loadingStates[`reject-${roast.id}`]}
                                    className="flex-1"
                                  >
                                    {loadingStates[`reject-${roast.id}`] ? '⏳' : '❌'} Rechazar
                                  </Button>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleApproveRoast(roast.id)}
                                    disabled={loadingStates[`approve-${roast.id}`]}
                                    className="flex-1"
                                  >
                                    {loadingStates[`approve-${roast.id}`] ? '⏳' : '✅'} Aprobar
                                  </Button>
                                </div>
                              )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Shield Tab */}
          {enableShield && (
            <TabsContent value="shield" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Roastr Shield</CardTitle>
                </CardHeader>
                <CardContent>
                  {accountDetails?.settings?.shieldEnabled ? (
                    <div className="space-y-6">
                      {/* Shield Stats */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                          Estadísticas de protección
                        </h4>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                              {intercepted.length}
                            </div>
                            <div className="text-xs text-blue-700 dark:text-blue-300">
                              Interceptados
                            </div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                              {accountDetails?.settings?.shieldLevel || 50}%
                            </div>
                            <div className="text-xs text-blue-700 dark:text-blue-300">
                              Nivel actual
                            </div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                              {intercepted.filter((i) => i.action === 'Reportar').length}
                            </div>
                            <div className="text-xs text-blue-700 dark:text-blue-300">
                              Reportados
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Shield Intercepted List */}
                      <ShieldInterceptedList
                        interceptedItems={intercepted}
                        onRevertAction={handleRevertShieldAction}
                        loading={shieldLoading}
                        onRefresh={handleRefreshShieldEvents}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400 mb-4">
                        Shield está desactivado para esta cuenta
                      </p>
                      <AccountSettingsDialog
                        account={account}
                        accountDetails={accountDetails}
                        onToggleAutoApprove={onToggleAutoApprove}
                        onToggleAccount={onToggleAccount}
                        onChangeShieldLevel={onChangeShieldLevel}
                        onToggleShield={onToggleShield}
                        onChangeTone={onChangeTone}
                        onDisconnectAccount={onDisconnectAccount}
                        trigger={<Button variant="outline">Activar Shield</Button>}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default AccountDetailPage;
