import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../../components/ThemeToggle';
import { authHelpers } from '../../lib/supabaseClient';

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const navigate = useNavigate();

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

  const loadUsers = async (accessToken) => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/admin/users', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      setAlert({
        type: 'error',
        message: 'Error al cargar usuarios: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserPlan = async (userId, newPlan) => {
    try {
      setActionLoading(prev => ({ ...prev, [`plan_${userId}`]: true }));
      
      const session = await authHelpers.getCurrentSession();
      const response = await fetch('/api/auth/admin/users/update-plan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, newPlan })
      });

      const data = await response.json();
      if (data.success) {
        setAlert({
          type: 'success',
          message: `Plan actualizado exitosamente a ${newPlan}`
        });
        // Refresh users list
        await loadUsers(session.access_token);
      } else {
        throw new Error(data.error || 'Error al actualizar plan');
      }
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Error al actualizar plan: ' + error.message
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [`plan_${userId}`]: false }));
    }
  };

  const resetUserPassword = async (userId) => {
    try {
      setActionLoading(prev => ({ ...prev, [`reset_${userId}`]: true }));
      
      const session = await authHelpers.getCurrentSession();
      const response = await fetch('/api/auth/admin/users/reset-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });

      const data = await response.json();
      if (data.success) {
        setAlert({
          type: 'success',
          message: `Email de recuperación enviado a ${data.data.email}`
        });
      } else {
        throw new Error(data.error || 'Error al enviar email de recuperación');
      }
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Error al resetear contraseña: ' + error.message
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [`reset_${userId}`]: false }));
    }
  };

  const suspendUser = async (userId, reason = null) => {
    try {
      setActionLoading(prev => ({ ...prev, [`suspend_${userId}`]: true }));
      
      const session = await authHelpers.getCurrentSession();
      const response = await fetch(`/api/auth/admin/users/${userId}/suspend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();
      if (data.success) {
        setAlert({
          type: 'success',
          message: 'Usuario suspendido exitosamente'
        });
        // Refresh users list
        await loadUsers(session.access_token);
      } else {
        throw new Error(data.error || 'Error al suspender usuario');
      }
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Error al suspender usuario: ' + error.message
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [`suspend_${userId}`]: false }));
    }
  };

  const unsuspendUser = async (userId) => {
    try {
      setActionLoading(prev => ({ ...prev, [`unsuspend_${userId}`]: true }));
      
      const session = await authHelpers.getCurrentSession();
      const response = await fetch(`/api/auth/admin/users/${userId}/unsuspend`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      if (data.success) {
        setAlert({
          type: 'success',
          message: 'Usuario reactivado exitosamente'
        });
        // Refresh users list
        await loadUsers(session.access_token);
      } else {
        throw new Error(data.error || 'Error al reactivar usuario');
      }
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Error al reactivar usuario: ' + error.message
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [`unsuspend_${userId}`]: false }));
    }
  };

  const handleSuspendClick = (userId, isSuspended) => {
    if (isSuspended) {
      if (window.confirm('¿Estás seguro de que quieres reactivar este usuario?')) {
        unsuspendUser(userId);
      }
    } else {
      const reason = window.prompt('Razón de la suspensión (opcional):');
      if (window.confirm('¿Estás seguro de que quieres suspender este usuario?')) {
        suspendUser(userId, reason);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await authHelpers.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const getPlanBadgeColor = (plan) => {
    const colors = {
      free: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      pro: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
      creator_plus: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
      custom: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
    };
    return colors[plan] || colors.free;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                  <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Panel de Administración
                </h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                Volver al Dashboard
              </button>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {currentUser?.email}
              </div>
              <button
                onClick={handleSignOut}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert */}
        {alert && (
          <div className={`mb-6 p-4 rounded-lg ${
            alert.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {alert.type === 'success' ? (
                  <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{alert.message}</p>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setAlert(null)}
                  className="inline-flex rounded-md p-1.5 hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-50 focus:ring-green-600"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Gestión de Usuarios ({users.length})
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Admin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Creado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Integraciones
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
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
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPlanBadgeColor(user.plan)}`}>
                        {user.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {user.suspended ? (
                          <span 
                            className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                            title={user.suspended_at ? `Suspendido el ${formatDate(user.suspended_at)}` : 'Usuario suspendido'}
                          >
                            🚫 Suspendido
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                            ✅ Activo
                          </span>
                        )}
                        {user.suspended && user.suspended_reason && (
                          <span 
                            className="text-xs text-gray-500 dark:text-gray-400 cursor-help" 
                            title={`Razón: ${user.suspended_reason}`}
                          >
                            ❓
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {user.is_admin ? (
                        <span className="text-green-600 dark:text-green-400">Sí</span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {user.organizations?.[0]?.monthly_responses_used || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex flex-wrap gap-2">
                        {/* Change Plan Button */}
                        <select
                          onChange={(e) => {
                            if (e.target.value && e.target.value !== user.plan) {
                              updateUserPlan(user.id, e.target.value);
                              e.target.value = user.plan; // Reset select
                            }
                          }}
                          disabled={actionLoading[`plan_${user.id}`]}
                          defaultValue=""
                          className="text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                        >
                          <option value="">✏️ Cambiar plan</option>
                          <option value="free">Free</option>
                          <option value="pro">Pro</option>
                          <option value="creator_plus">Creator Plus</option>
                          <option value="custom">Custom</option>
                        </select>

                        {/* Suspend/Unsuspend Button */}
                        <button
                          onClick={() => handleSuspendClick(user.id, user.suspended)}
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

                        {/* Reset Password Button */}
                        <button
                          onClick={() => resetUserPassword(user.id)}
                          disabled={actionLoading[`reset_${user.id}`]}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 shadow-sm text-xs leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                        >
                          {actionLoading[`reset_${user.id}`] ? (
                            <svg className="animate-spin -ml-1 mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            '🔁'
                          )}
                          Reset
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No hay usuarios</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Aún no se han registrado usuarios en el sistema.
              </p>
            </div>
          )}
        </div>
      </main>

      <ThemeToggle />
    </div>
  );
};

export default AdminUsersPage;