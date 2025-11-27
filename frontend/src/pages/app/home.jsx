/**
 * Home Page - Issue #1043
 *
 * Página principal de la app de usuario (/app)
 * Integra widgets de uso, redes disponibles y tabla de cuentas
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UsageWidgets from '../../components/app/home/usage-widgets';
import ConnectNetworkCard from '../../components/app/home/connect-network-card';
import AccountsTable from '../../components/app/home/accounts-table';
import { apiClient } from '../../lib/api';
import { getIntegrations } from '../../api/integrations';

export default function Home() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const result = await getIntegrations();
        const accountsList = result?.integrations ?? result?.data ?? [];
        setAccounts(accountsList);
      } catch (error) {
        console.error('Error fetching accounts:', error);
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  const handleAccountConnected = async () => {
    // Refrescar lista de cuentas después de conectar
    try {
      const result = await getIntegrations();
      const accountsList = result?.integrations ?? result?.data ?? [];
      setAccounts(accountsList);
    } catch (error) {
      console.error('Error refreshing accounts:', error);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Inicio</h1>
        <p className="text-muted-foreground">Gestiona tus cuentas y revisa tu consumo mensual</p>
      </div>

      {/* Widgets de Análisis - Issue #1044 */}
      <UsageWidgets />

      {/* Bloque de Redes Disponibles - Issue #1045 */}
      <ConnectNetworkCard accounts={accounts} onAccountConnected={handleAccountConnected} />

      {/* Tabla de Cuentas Conectadas - Issue #1046 */}
      <AccountsTable />
    </div>
  );
}
