import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../../components/ThemeToggle';
import SuspensionModal from '../../components/admin/SuspensionModal';
import ToastNotification from '../../components/admin/ToastNotification';
import VirtualScrollTable from '../../components/admin/VirtualScrollTable';
import { authHelpers } from '../../lib/supabaseClient';
import { apiClient } from '../../lib/api';
import { getPlanBadgeColor, getPlanDisplayName, normalizePlanId } from '../../utils/planHelpers';

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  
  // Search and filtering state - Issue #240
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const usersPerPage = 25;

  // Plan change modal state - Issue #240
  const [planChangeModal, setPlanChangeModal] = useState({
    isOpen: false,
    user: null,
    newPlan: null
  });

  const [suspensionModal, setSuspensionModal] = useState({
    isOpen: false,
    user: null,
    action: null // 'suspend' or 'unsuspend'
  });
  const [toast, setToast] = useState({
    isVisible: false,
    message: '',
    type: 'success'
  });
  const navigate = useNavigate();

  // Helper to show toast notifications
  const showToast = useCallback((message, type = 'success') => {
    setToast({ isVisible: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, isVisible: false }));
  }, []);

  // Check admin access and load users
  useEffect(() => {
    const checkAdminAndLoadUsers = async () => {
      try {
        // Get current session
        const session = await authHelpers.getCurrentSession();
        if (!session?.access_token) {
          navigate('/login');
          return;
        }

        // Get user data from backend
        const userData = await authHelpers.getUserFromAPI(session.access_token);
        if (!userData.is_admin) {
          navigate('/dashboard');
          return;
        }

        setCurrentUser(userData);
        
        // Fetch all users
        await loadUsers(session.access_token);
      } catch (error) {
        console.error('Admin check error:', error);
        navigate('/dashboard');
      }
    };

    checkAdminAndLoadUsers();
  }, [navigate]);

  // Load users with search and pagination - Issue #240
  useEffect(() => {
    if (currentUser) {
      const loadData = async () => {
        const session = await authHelpers.getCurrentSession();
        if (session?.access_token) {
          await loadUsers(session.access_token);
        }
      };
      loadData();
    }
  }, [currentUser, searchTerm, selectedPlan, currentPage]);

  const loadUsers = useCallback(async (accessToken) => {
    try {
      setLoading(true);
      setAlert(null); // Clear any previous errors

      // Build query parameters for new backend endpoint
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: usersPerPage.toString()
      });

      if (searchTerm) params.append('search', searchTerm);
      if (selectedPlan) params.append('plan', selectedPlan);

      const data = await apiClient.get(`/admin/users?${params}`);

      if (data.success) {
        setUsers(data.data.users || []);
        setTotalPages(data.data.pagination?.total_pages || 1);
        setTotalUsers(data.data.pagination?.total || 0);
      } else {
        throw new Error(data.message || 'Error desconocido al cargar usuarios');
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      setAlert({
        type: 'error',
        message: error.message || 'Error cargando usuarios'
      });

      // If it's an auth error, redirect to login
      if (error.message && (error.message.includes('Sesión expirada') || error.message.includes('permisos de administrador'))) {
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, selectedPlan, navigate]);

  // Plan change functions - Issue #240
  const handlePlanChangeClick = useCallback((user, newPlan) => {
    setPlanChangeModal({
      isOpen: true,
      user: user,
      newPlan: newPlan
    });
  }, []);

  const handlePlanChangeConfirm = useCallback(async () => {
    const { user, newPlan } = planChangeModal;
    if (!user || !newPlan) return;

    try {
      setActionLoading(prev => ({ ...prev, [`plan_${user.id}`]: true }));

      const data = await apiClient.patch(`/admin/users/${user.id}/plan`, { plan: newPlan });

      if (data.success) {
        showToast(data.data.message, 'success');
        // Refresh users list
        const session = await authHelpers.getCurrentSession();
        await loadUsers(session.access_token);
      } else {
        throw new Error(data.message || 'Error al actualizar plan');
      }
    } catch (error) {
      showToast('Error al actualizar plan: ' + error.message, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [`plan_${user.id}`]: false }));
      setPlanChangeModal({ isOpen: false, user: null, newPlan: null });
    }
  }, [planChangeModal, showToast, loadUsers]);

  const handlePlanChangeCancel = useCallback(() => {
    setPlanChangeModal({ isOpen: false, user: null, newPlan: null });
  }, []);

  // Navigation to superuser dashboard - Issue #240
  const handleViewUserDashboard = useCallback((user) => {
    // Store the admin context for the superuser mode
    sessionStorage.setItem('adminMode', 'true');
    sessionStorage.setItem('adminModeUser', JSON.stringify(user));
    navigate(`/dashboard?userId=${user.id}&adminMode=true`);
  }, [navigate]);

  // Search handlers - Issue #240
  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page when searching
  }, []);

  const handlePlanFilterChange = useCallback((e) => {
    setSelectedPlan(e.target.value);
    setCurrentPage(1); // Reset to first page when filtering
  }, []);

  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage);
  }, []);

  const resetUserPassword = useCallback(async (userId) => {
    try {
      setActionLoading(prev => ({ ...prev, [`reset_${userId}`]: true }));

      const data = await apiClient.post('/auth/admin/users/reset-password', { userId });

      if (data.success) {
        showToast(`Email de recuperación enviado a ${data.data.email}`, 'success');
      } else {
        throw new Error(data.error || 'Error al enviar email de recuperación');
      }
    } catch (error) {
      showToast('Error al resetear contraseña: ' + error.message, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [`reset_${userId}`]: false }));
    }
  }, [showToast]);

  const suspendUser = useCallback(async (userId, reason = null) => {
    try {
      setActionLoading(prev => ({ ...prev, [`suspend_${userId}`]: true }));

      const data = await apiClient.post(`/auth/admin/users/${userId}/suspend`, { reason });

      if (data.success) {
        showToast('Usuario suspendido exitosamente', 'success');
        // Refresh users list
        const session = await authHelpers.getCurrentSession();
        await loadUsers(session.access_token);
      } else {
        throw new Error(data.error || 'Error al suspender usuario');
      }
    } catch (error) {
      showToast('Error al suspender usuario: ' + error.message, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [`suspend_${userId}`]: false }));
    }
  }, [showToast, loadUsers]);

  const unsuspendUser = useCallback(async (userId) => {
    try {
      setActionLoading(prev => ({ ...prev, [`unsuspend_${userId}`]: true }));

      const data = await apiClient.post(`/auth/admin/users/${userId}/unsuspend`);

      if (data.success) {
        showToast('Usuario reactivado exitosamente', 'success');
        // Refresh users list
        const session = await authHelpers.getCurrentSession();
        await loadUsers(session.access_token);
      } else {
        throw new Error(data.error || 'Error al reactivar usuario');
      }
    } catch (error) {
      showToast('Error al reactivar usuario: ' + error.message, 'error');
    } finally {
      setActionLoading(prev => ({ ...prev, [`unsuspend_${userId}`]: false }));
    }
  }, [showToast, loadUsers]);

  const handleSuspendClick = useCallback((user) => {
    const action = user.suspended ? 'unsuspend' : 'suspend';
    setSuspensionModal({
      isOpen: true,
      user: user,
      action: action
    });
  }, []);

  const handleSuspensionConfirm = useCallback(async (reason) => {
    const { user, action } = suspensionModal;
    
    if (action === 'suspend') {
      await suspendUser(user.id, reason);
    } else {
      await unsuspendUser(user.id);
    }
    
    setSuspensionModal({
      isOpen: false,
      user: null,
      action: null
    });
  }, [suspensionModal, suspendUser, unsuspendUser]);

  const handleSuspensionCancel = useCallback(() => {
    setSuspensionModal({
      isOpen: false,
      user: null,
      action: null
    });
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await authHelpers.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, [navigate]);


  const formatDate = useMemo(() => (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  // Render functions for virtual scrolling
  const renderTableHeader = useCallback(() => (
    <thead className="bg-gray-50 dark:bg-gray-700">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
          Usuario
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
          Handles Conectados
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
          Plan
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
          Uso
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
          Estado
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
          Acciones
        </th>
      </tr>
    </thead>
  ), []);

  const renderUserRow = useCallback((user, index) => (
    <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
      {/* User Info */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {user.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {user.name || 'Sin nombre'}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {user.email}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500">
              ID: {user.id.slice(0, 8)}...
            </div>
          </div>
        </div>
      </td>

      {/* Handles - Issue #240 */}
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900 dark:text-white">
          {user.handles && user.handles !== 'No connections' && user.handles !== 'Error loading' ? (
            <div className="space-y-1">
              {user.handles.split(', ').map((handle, idx) => (
                <div key={idx} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 mr-1 mb-1">
                  {handle}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-gray-500 dark:text-gray-400 text-xs">
              {user.handles || 'Sin conexiones'}
            </span>
          )}
        </div>
      </td>

      {/* Plan */}
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPlanBadgeColor(user.plan)}`}>
          {getPlanDisplayName(user.plan)}
        </span>
      </td>

      {/* Usage - Issue #240 */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900 dark:text-white">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Roasts: {user.usage?.roasts || '0/0'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Análisis: {user.usage?.analysis || '0/0'}
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex flex-col space-y-1">
          {user.suspended ? (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
              🚫 Suspendido
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
              ✅ Activo
            </span>
          )}
          {user.is_admin && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
              👑 Admin
            </span>
          )}
        </div>
      </td>
      
      {/* Actions - Issue #240 */}
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex flex-col gap-2">
          {/* Plan Change Dropdown - Issue #240 */}
          {(() => {
            const normalizedPlan = normalizePlanId(user.plan);
            return (
              <select
                onChange={(e) => {
                  if (e.target.value && e.target.value !== normalizedPlan) {
                    handlePlanChangeClick(user, e.target.value);
                    e.target.value = ""; // Reset select
                  }
                }}
                disabled={actionLoading[`plan_${user.id}`]}
                defaultValue=""
                className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              >
                <option value="">📋 Plan: {getPlanDisplayName(user.plan)}</option>
                {normalizedPlan !== 'starter_trial' && <option value="starter_trial">→ Starter Trial</option>}
                {normalizedPlan !== 'starter' && <option value="starter">→ Starter</option>}
                {normalizedPlan !== 'pro' && <option value="pro">→ Pro</option>}
                {normalizedPlan !== 'plus' && <option value="plus">→ Plus</option>}
              </select>
            );
          })()}

          {/* Superuser Dashboard Button - Issue #240 */}
          <button
            onClick={() => handleViewUserDashboard(user)}
            className="inline-flex items-center px-3 py-1 border border-purple-300 dark:border-purple-600 shadow-sm text-xs leading-4 font-medium rounded-md text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            🔍 Dashboard
          </button>

          {/* Suspend/Unsuspend Button */}
          {currentUser?.id === user.id ? (
            <span className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-xs leading-4 font-medium rounded-md text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 cursor-not-allowed">
              👤 Tu cuenta
            </span>
          ) : (
            <button
              onClick={() => handleSuspendClick(user)}
              disabled={actionLoading[`suspend_${user.id}`] || actionLoading[`unsuspend_${user.id}`]}
              className={`inline-flex items-center px-3 py-1 border shadow-sm text-xs leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                user.suspended 
                  ? 'border-green-300 dark:border-green-600 text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 focus:ring-green-500'
                  : 'border-red-300 dark:border-red-600 text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 focus:ring-red-500'
              }`}
            >
              {(actionLoading[`suspend_${user.id}`] || actionLoading[`unsuspend_${user.id}`]) ? (
                <svg className="animate-spin -ml-1 mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : user.suspended ? (
                '✅'
              ) : (
                '🚫'
              )}
              {user.suspended ? 'Reactivar' : 'Suspender'}
            </button>
          )}
        </div>
      </td>
    </tr>
  ), [actionLoading, currentUser, getPlanBadgeColor, handlePlanChangeClick, handleViewUserDashboard, handleSuspendClick]);

  // Virtual scrolling functions already defined above

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Cargando usuarios...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Por favor espera un momento
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Panel de Administración
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <ThemeToggle />
                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Filters and Search - Issue #261: Removed unused filter button (filters apply automatically) */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Buscar</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  placeholder="ID, email o handle de red social..."
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filtro por plan</label>
                <select
                  value={selectedPlan}
                  onChange={handlePlanFilterChange}
                  className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Todos los planes</option>
                  <option value="starter_trial">Starter Trial</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="plus">Plus</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      
        {/* Error Alert - Issue #240 */}
      {alert && (
        <div className={`rounded-md p-4 mb-6 ${
          alert.type === 'error' 
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' 
            : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {alert.type === 'error' ? (
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm font-medium ${
                alert.type === 'error' 
                  ? 'text-red-800 dark:text-red-200' 
                  : 'text-green-800 dark:text-green-200'
              }`}>
                {alert.message}
              </p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  type="button"
                  onClick={() => setAlert(null)}
                  className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    alert.type === 'error'
                      ? 'text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 focus:ring-red-600 focus:ring-offset-red-50'
                      : 'text-green-500 hover:bg-green-100 dark:hover:bg-green-900/40 focus:ring-green-600 focus:ring-offset-green-50'
                  }`}
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Gestión de Usuarios ({totalUsers})
              </h2>
              {searchTerm && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Mostrando resultados para: "{searchTerm}"
                </div>
              )}
            </div>
          </div>
          
          {/* Virtual Scrolling Table - Issue #261 */}
          {loading ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Usuario
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Handles Conectados
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Uso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {/* Loading Skeleton - Issue #240 */}
                  {[...Array(3)].map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600"></div>
                          <div className="ml-3">
                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded mb-1"></div>
                            <div className="h-3 w-32 bg-gray-200 dark:bg-gray-600 rounded mb-1"></div>
                            <div className="h-2 w-20 bg-gray-200 dark:bg-gray-600 rounded"></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-5 w-12 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-600 rounded mb-1"></div>
                        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-600 rounded"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-2">
                          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-600 rounded"></div>
                          <div className="h-6 w-16 bg-gray-200 dark:bg-gray-600 rounded"></div>
                          <div className="h-6 w-18 bg-gray-200 dark:bg-gray-600 rounded"></div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <VirtualScrollTable
              data={users}
              rowHeight={120}
              visibleRows={12}
              renderRow={renderUserRow}
              renderHeader={renderTableHeader}
              threshold={1000}
              className="overflow-x-auto"
            />
          )}

          {users.length === 0 && !loading && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                {searchTerm || selectedPlan ? 'No se encontraron usuarios' : 'No hay usuarios'}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {searchTerm || selectedPlan 
                  ? 'Intenta ajustar tus filtros de búsqueda.' 
                  : 'Aún no se han registrado usuarios en el sistema.'
                }
              </p>
            </div>
          )}
        </div>

        {/* Pagination - Issue #240 */}
        {totalPages > 1 && (
          <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6 rounded-b-lg mt-4">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Mostrando{' '}
                  <span className="font-medium">{((currentPage - 1) * usersPerPage) + 1}</span>
                  {' '}a{' '}
                  <span className="font-medium">{Math.min(currentPage * usersPerPage, totalUsers)}</span>
                  {' '}de{' '}
                  <span className="font-medium">{totalUsers}</span>
                  {' '}usuarios
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Página anterior</span>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {[...Array(Math.min(totalPages, 5))].map((_, index) => {
                    const pageNumber = Math.max(1, currentPage - 2) + index;
                    if (pageNumber > totalPages) return null;
                    
                    return (
                      <button
                        key={pageNumber}
                        onClick={() => handlePageChange(pageNumber)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === pageNumber
                            ? 'z-10 bg-primary-50 dark:bg-primary-900/20 border-primary-500 text-primary-600 dark:text-primary-400'
                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Página siguiente</span>
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
        </main>
      </div>
      {/* Suspension Modal */}
      <SuspensionModal
        isOpen={suspensionModal.isOpen}
        onClose={handleSuspensionCancel}
        onConfirm={handleSuspensionConfirm}
        user={suspensionModal.user}
        action={suspensionModal.action}
        isLoading={actionLoading[`suspend_${suspensionModal.user?.id}`] || actionLoading[`unsuspend_${suspensionModal.user?.id}`]}
      />

      {/* Plan Change Confirmation Modal - Issue #240 */}
      {planChangeModal.isOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900">
                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mt-3">
                Confirmar cambio de plan
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  ¿Estás seguro de que quieres cambiar el plan de <strong>{planChangeModal.user?.email}</strong> de{' '}
                  <span className="font-semibold">
                    {getPlanDisplayName(planChangeModal.user?.plan)}
                  </span> a{' '}
                  <span className="font-semibold">
                    {getPlanDisplayName(planChangeModal.newPlan)}
                  </span>?
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <button
                  onClick={handlePlanChangeConfirm}
                  disabled={actionLoading[`plan_${planChangeModal.user?.id}`]}
                  className="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-24 mr-2 shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
                >
                  {actionLoading[`plan_${planChangeModal.user?.id}`] ? (
                    <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    'Confirmar'
                  )}
                </button>
                <button
                  onClick={handlePlanChangeCancel}
                  disabled={actionLoading[`plan_${planChangeModal.user?.id}`]}
                  className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-24 shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <ToastNotification
        isVisible={toast.isVisible}
        message={toast.message}
        type={toast.type}
        onClose={hideToast}
      />
    </>
  );
};

export default AdminUsersPage;