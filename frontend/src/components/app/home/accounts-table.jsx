/**
 * Accounts Table Component - Issue #1046
 *
 * Tabla de cuentas conectadas con navegación a detalle
 * Endpoint: /api/accounts
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table';
import { Badge } from '../../ui/badge';
import { Skeleton } from '../../ui/skeleton';
import { AlertTriangle, Shield, MessageCircle } from 'lucide-react';
import { platformIcons, platformNames } from '../../../config/platforms';
import { apiClient } from '../../../lib/api';

// Simple logger for frontend (CodeRabbit requirement)
const logger = {
  error: (message, error) => {
    console.error(message, error);
    // In production, could send to error tracking service
  }
};

export default function AccountsTable({ accounts: accountsProp }) {
  const [accounts, setAccounts] = useState(accountsProp || []);
  const [loading, setLoading] = useState(!accountsProp);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Update accounts when prop changes
  useEffect(() => {
    if (accountsProp) {
      setAccounts(accountsProp);
      setLoading(false);
    }
  }, [accountsProp]);

  // Only fetch if no accounts prop provided (CodeRabbit fix: eliminate duplicate API calls)
  useEffect(() => {
    if (accountsProp) {
      // Accounts provided as prop, skip fetching
      return;
    }

    const fetchAccounts = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.get('/accounts');
        const data = response.data || response;

        // Normalizar formato de respuesta
        const accountsList = Array.isArray(data) ? data : data.accounts || data.data || [];

        setAccounts(accountsList);
      } catch (err) {
        logger.error('Error fetching accounts:', err);
        setError(err.message || 'Error al cargar cuentas');
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [accountsProp]);

  const handleRowClick = (accountId) => {
    navigate(`/app/accounts/${accountId}`);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      active: { variant: 'default', label: 'Activa' },
      connected: { variant: 'default', label: 'Conectada' },
      disconnected: { variant: 'secondary', label: 'Desconectada' },
      error: { variant: 'destructive', label: 'Error' },
      pending: { variant: 'secondary', label: 'Pendiente' }
    };

    const statusConfig = statusMap[status?.toLowerCase()] || statusMap.pending;
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cuentas Conectadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8 text-center">
            <div className="space-y-2">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cuentas Conectadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8 text-center">
            <div className="space-y-2">
              <MessageCircle className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                No tienes cuentas conectadas. Conecta una red social para empezar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cuentas Conectadas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Red Social</TableHead>
                <TableHead>Handle</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Roasts Emitidos</TableHead>
                <TableHead className="text-right">Intercepciones Shield</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const PlatformIcon = platformIcons[account.platform] || platformIcons.twitter;
                const platformName = platformNames[account.platform] || account.platform;
                const handle =
                  account.handle || account.username || account.external_username || 'N/A';
                const roastsCount = account.roasts_count || account.roasts || 0;
                const shieldCount = account.shield_interceptions || account.shield_count || 0;

                return (
                  <TableRow
                    key={account.id || account.account_id}
                    onClick={() => handleRowClick(account.id || account.account_id)}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <PlatformIcon className="h-5 w-5" />
                        <span className="font-medium">{platformName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{handle}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(account.status)}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">{roastsCount.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{shieldCount.toLocaleString()}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
