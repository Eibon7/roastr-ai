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

// Simple logger for frontend (CodeRabbit requirement)
const logger = {
  error: (message, error) => {
    console.error(message, error);
    // In production, could send to error tracking service
  }
};

export default function Home() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        // Use /api/accounts endpoint directly (Issue #1046)
        const response = await apiClient.get('/accounts');
        const responseData = response.data || response;
        // Handle standardized response format (Issue #1081: success: true, data: [...])
        const accountsList = responseData.data || responseData || [];
        setAccounts(Array.isArray(accountsList) ? accountsList : []);
      } catch (error) {
        logger.error('Error fetching accounts:', error);
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
      const response = await apiClient.get('/accounts');
      const accountsList = response.data || response || [];
      setAccounts(Array.isArray(accountsList) ? accountsList : []);
    } catch (error) {
      logger.error('Error refreshing accounts:', error);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Inicio</h1>
        <p className="text-muted-foreground">
          Gestiona tus cuentas y revisa tu consumo mensual
        </p>
      </div>

      {/* Widgets de Análisis - Issue #1044 */}
      <UsageWidgets />

      {/* Bloque de Redes Disponibles - Issue #1045 */}
      <ConnectNetworkCard 
        accounts={accounts} 
        onAccountConnected={handleAccountConnected}
      />

      {/* Tabla de Cuentas Conectadas - Issue #1046 */}
      {/* Pass accounts as prop to avoid duplicate API calls (CodeRabbit fix) */}
      <AccountsTable accounts={accounts} />
    </div>
  );
}

