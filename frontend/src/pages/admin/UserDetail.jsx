import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

const UserDetail = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [activity, setActivity] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [configLoading, setConfigLoading] = useState(false);
    
    // Editable configuration state
    const [editableConfig, setEditableConfig] = useState({
        plan: '',
        tone: 'Balanceado',
        shieldEnabled: true,
        autoReplyEnabled: false,
        persona: {
            defines: '',
            doesntTolerate: '',
            doesntCare: ''
        }
    });

    // Check admin status
    useEffect(() => {
        const checkAdminStatus = async () => {
            try {
                const token = localStorage.getItem('auth_token');
                if (!token) {
                    navigate('/login');
                    return;
                }

                const response = await fetch('/api/auth/me', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const userData = await response.json();
                    if (!userData.data.is_admin) {
                        navigate('/dashboard');
                        return;
                    }
                    setIsAdmin(true);
                } else {
                    navigate('/login');
                    return;
                }
            } catch (error) {
                console.error('Error checking admin status:', error);
                navigate('/login');
            }
        };

        checkAdminStatus();
    }, [navigate]);

    // Fetch user details
    useEffect(() => {
        const fetchUserDetails = async () => {
            if (!isAdmin) return;
            
            try {
                const token = localStorage.getItem('auth_token');
                const response = await fetch(`/api/auth/admin/users/${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setUser(data.data.user);
                    setStats(data.data);
                    
                    // Initialize editable configuration with current user data
                    setEditableConfig({
                        plan: data.data.user.plan || 'free',
                        tone: data.data.user.tone || 'Balanceado',
                        shieldEnabled: data.data.user.shield_enabled !== false,
                        autoReplyEnabled: data.data.user.auto_reply_enabled === true,
                        persona: {
                            defines: data.data.user.persona_defines || '',
                            doesntTolerate: data.data.user.persona_doesnt_tolerate || '',
                            doesntCare: data.data.user.persona_doesnt_care || ''
                        }
                    });
                } else {
                    const errorData = await response.json();
                    setError(errorData.error || 'Error fetching user details');
                }
            } catch (error) {
                setError('Network error occurred');
                console.error('Error fetching user details:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUserDetails();
        fetchUserActivity();
    }, [userId, isAdmin]);

    // Fetch detailed user activity
    const fetchUserActivity = async () => {
        if (!isAdmin) return;
        
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/admin/users/${userId}/activity`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setActivity(data.data);
            } else {
                console.warn('Could not fetch user activity data');
            }
        } catch (error) {
            console.warn('Error fetching user activity:', error);
        }
    };

    const handleToggleActive = async () => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/auth/admin/users/${userId}/toggle-active`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.data.user);
            } else {
                const errorData = await response.json();
                alert('Error: ' + (errorData.error || 'Failed to update user status'));
            }
        } catch (error) {
            console.error('Error toggling user status:', error);
            alert('Network error occurred');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSuspend = async () => {
        const reason = prompt('Enter suspension reason (optional):');
        if (reason === null) return; // User cancelled

        setActionLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/auth/admin/users/${userId}/suspend`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason: reason || null })
            });

            if (response.ok) {
                // Refresh user data
                window.location.reload();
            } else {
                const errorData = await response.json();
                alert('Error: ' + (errorData.error || 'Failed to suspend user'));
            }
        } catch (error) {
            console.error('Error suspending user:', error);
            alert('Network error occurred');
        } finally {
            setActionLoading(false);
        }
    };

    const handleUnsuspend = async () => {
        setActionLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/auth/admin/users/${userId}/unsuspend`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                // Refresh user data
                window.location.reload();
            } else {
                const errorData = await response.json();
                alert('Error: ' + (errorData.error || 'Failed to unsuspend user'));
            }
        } catch (error) {
            console.error('Error unsuspending user:', error);
            alert('Network error occurred');
        } finally {
            setActionLoading(false);
        }
    };

    const handleChangePlan = async () => {
        const newPlan = prompt('Enter new plan (basic, pro, creator_plus):');
        if (!newPlan) return;

        const validPlans = ['basic', 'pro', 'creator_plus'];
        if (!validPlans.includes(newPlan.toLowerCase())) {
            alert('Invalid plan. Valid options: basic, pro, creator_plus');
            return;
        }

        setActionLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/auth/admin/users/${userId}/plan`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ newPlan: newPlan.toLowerCase() })
            });

            if (response.ok) {
                // Refresh user data
                window.location.reload();
            } else {
                const errorData = await response.json();
                alert('Error: ' + (errorData.error || 'Failed to change user plan'));
            }
        } catch (error) {
            console.error('Error changing user plan:', error);
            alert('Network error occurred');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSaveConfiguration = async () => {
        setConfigLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/admin/users/${userId}/config`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(editableConfig)
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.data.user);
                alert('Configuración actualizada exitosamente');
            } else {
                const errorData = await response.json();
                alert('Error: ' + (errorData.error || 'Failed to update configuration'));
            }
        } catch (error) {
            console.error('Error updating configuration:', error);
            alert('Network error occurred');
        } finally {
            setConfigLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!window.confirm(`¿Estás seguro de que quieres resetear la contraseña de ${user.email}?`)) {
            return;
        }

        setActionLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/auth/admin/users/reset-password', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId })
            });

            if (response.ok) {
                alert('Email de reset de contraseña enviado al usuario');
            } else {
                const errorData = await response.json();
                alert('Error: ' + (errorData.error || 'Failed to reset password'));
            }
        } catch (error) {
            console.error('Error resetting password:', error);
            alert('Network error occurred');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReAuthIntegrations = async () => {
        if (!window.confirm(`¿Estás seguro de que quieres invalidar las integraciones de ${user.email}?`)) {
            return;
        }

        setActionLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/admin/users/${userId}/reauth-integrations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                alert('Integraciones invalidadas. El usuario deberá reautenticar sus cuentas.');
            } else {
                const errorData = await response.json();
                alert('Error: ' + (errorData.error || 'Failed to reauth integrations'));
            }
        } catch (error) {
            console.error('Error reauth integrations:', error);
            alert('Network error occurred');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        const confirm1 = window.confirm(`¿Estás seguro de que quieres eliminar la cuenta de ${user.email}?`);
        if (!confirm1) return;
        
        const confirm2 = window.confirm('Esta acción NO se puede deshacer. ¿Continuar?');
        if (!confirm2) return;

        setActionLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/auth/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                alert('Cuenta eliminada exitosamente');
                navigate('/admin/users');
            } else {
                const errorData = await response.json();
                alert('Error: ' + (errorData.error || 'Failed to delete account'));
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            alert('Network error occurred');
        } finally {
            setActionLoading(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getPlanBadgeColor = (plan) => {
        const colors = {
            basic: 'bg-gray-100 text-gray-800',
            pro: 'bg-blue-100 text-blue-800',
            creator_plus: 'bg-purple-100 text-purple-800'
        };
        return colors[plan] || 'bg-gray-100 text-gray-800';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Cargando detalles del usuario...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-red-600 text-xl mb-4">❌ Error</div>
                    <p className="text-gray-600 mb-4">{error}</p>
                    <Link 
                        to="/admin" 
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        Volver al Panel de Administración
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <>  
            {/* Superuser Banner */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-6">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-yellow-700 dark:text-yellow-200">
                            <strong>Vista de superusuario</strong> – actuando sobre la cuenta de <span className="font-semibold">{user.email}</span>
                        </p>
                    </div>
                </div>
            </div>
            
            {/* Header */}
            <div className="mb-6">
                <nav className="flex" aria-label="Breadcrumb">
                    <ol className="flex items-center space-x-4">
                        <li>
                            <Link to="/admin/users" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
                                Usuarios
                            </Link>
                        </li>
                        <li className="flex items-center">
                            <svg className="flex-shrink-0 h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            <span className="ml-4 text-sm font-medium text-gray-500">
                                Detalles de Usuario
                            </span>
                        </li>
                    </ol>
                </nav>
            </div>

            {/* User Info Header */}
            <div className="bg-white shadow rounded-lg mb-6">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <span className="text-xl font-semibold text-blue-600">
                                        {(user.name || user.email).charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">
                                        {user.name || 'Usuario sin nombre'}
                                    </h1>
                                    <p className="text-gray-600">{user.email}</p>
                                    <div className="flex items-center space-x-2 mt-1">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPlanBadgeColor(user.plan)}`}>
                                            {user.plan.toUpperCase()}
                                        </span>
                                        {!user.active && (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                Inactivo
                                            </span>
                                        )}
                                        {user.suspended && (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                Suspendido
                                            </span>
                                        )}
                                        {user.is_admin && (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                Admin
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex space-x-2">
                                <button
                                    onClick={handleToggleActive}
                                    disabled={actionLoading}
                                    className={`px-4 py-2 text-sm font-medium rounded-md ${
                                        user.active
                                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                >
                                    {actionLoading ? 'Procesando...' : (user.active ? 'Desactivar' : 'Activar')}
                                </button>
                                {user.suspended ? (
                                    <button
                                        onClick={handleUnsuspend}
                                        disabled={actionLoading}
                                        className="px-4 py-2 text-sm font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {actionLoading ? 'Procesando...' : 'Quitar Suspensión'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSuspend}
                                        disabled={actionLoading}
                                        className="px-4 py-2 text-sm font-medium rounded-md bg-yellow-100 text-yellow-700 hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {actionLoading ? 'Procesando...' : 'Suspender'}
                                    </button>
                                )}
                                <button
                                    onClick={handleChangePlan}
                                    disabled={actionLoading}
                                    className="px-4 py-2 text-sm font-medium rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {actionLoading ? 'Procesando...' : 'Cambiar Plan'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-md">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Mensajes Mensuales</p>
                                <p className="text-2xl font-semibold text-gray-900">
                                    {stats.monthly_stats.messages_sent}
                                </p>
                                <p className="text-xs text-gray-500">
                                    de {stats.plan_limits.monthly_messages} límite
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-md">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Tokens Consumidos</p>
                                <p className="text-2xl font-semibold text-gray-900">
                                    {stats.monthly_stats.tokens_consumed}
                                </p>
                                <p className="text-xs text-gray-500">
                                    de {stats.plan_limits.monthly_tokens} límite
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-md">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Actividades Recientes</p>
                                <p className="text-2xl font-semibold text-gray-900">
                                    {stats.monthly_stats.activities_count}
                                </p>
                                <p className="text-xs text-gray-500">últimos 30 días</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white shadow rounded-lg p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-yellow-100 rounded-md">
                                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-600">Alertas</p>
                                <p className="text-2xl font-semibold text-gray-900">
                                    {stats.usage_alerts.length}
                                </p>
                                <p className="text-xs text-gray-500">
                                    {stats.is_over_limit ? 'Límites excedidos' : 'Dentro del límite'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alerts Section */}
                {stats.usage_alerts.length > 0 && (
                    <div className="bg-white shadow rounded-lg mb-6">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Alertas de Uso</h3>
                        </div>
                        <div className="px-6 py-4 space-y-3">
                            {stats.usage_alerts.map((alert, index) => (
                                <div
                                    key={index}
                                    className={`p-4 rounded-md ${
                                        alert.severity === 'high' 
                                            ? 'bg-red-50 border border-red-200' 
                                            : 'bg-yellow-50 border border-yellow-200'
                                    }`}
                                >
                                    <div className="flex">
                                        <div className="flex-shrink-0">
                                            {alert.severity === 'high' ? (
                                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                </svg>
                                            ) : (
                                                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="ml-3">
                                            <p className={`text-sm font-medium ${
                                                alert.severity === 'high' ? 'text-red-800' : 'text-yellow-800'
                                            }`}>
                                                {alert.message}
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1">
                                                Categoría: {alert.category}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Editable Configuration */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Configuraciones Editables</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Editar configuraciones del usuario desde el panel de administración</p>
                    </div>
                    <div className="px-6 py-4 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Plan</label>
                                <select 
                                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                    value={editableConfig.plan}
                                    onChange={(e) => setEditableConfig({...editableConfig, plan: e.target.value})}
                                >
                                    <option value="free">Free</option>
                                    <option value="pro">Pro</option>
                                    <option value="creator_plus">Creator Plus</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tono</label>
                                <select 
                                    className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                    value={editableConfig.tone}
                                    onChange={(e) => setEditableConfig({...editableConfig, tone: e.target.value})}
                                >
                                    <option value="Flanders">Flanders</option>
                                    <option value="Balanceado">Balanceado</option>
                                    <option value="Canalla">Canalla</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Shield (Escudo)</label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Protección automática contra toxicidad</p>
                                </div>
                                <div>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                        checked={editableConfig.shieldEnabled}
                                        onChange={(e) => setEditableConfig({...editableConfig, shieldEnabled: e.target.checked})}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Auto-reply (Respuesta automática)</label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Respuestas automáticas a comentarios</p>
                                </div>
                                <div>
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                                        checked={editableConfig.autoReplyEnabled}
                                        onChange={(e) => setEditableConfig({...editableConfig, autoReplyEnabled: e.target.checked})}
                                    />
                                </div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Roastr Persona</label>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Lo que me define</label>
                                    <textarea
                                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                        rows="2"
                                        placeholder="Personalidad, intereses, forma de hablar..."
                                        value={editableConfig.persona.defines}
                                        onChange={(e) => setEditableConfig({...editableConfig, persona: {...editableConfig.persona, defines: e.target.value}})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">No tolero</label>
                                    <textarea
                                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                        rows="2"
                                        placeholder="Temas o comportamientos que no acepta..."
                                        value={editableConfig.persona.doesntTolerate}
                                        onChange={(e) => setEditableConfig({...editableConfig, persona: {...editableConfig.persona, doesntTolerate: e.target.value}})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Me da igual</label>
                                    <textarea
                                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                                        rows="2"
                                        placeholder="Temas neutrales, aspectos que no le afectan..."
                                        value={editableConfig.persona.doesntCare}
                                        onChange={(e) => setEditableConfig({...editableConfig, persona: {...editableConfig.persona, doesntCare: e.target.value}})}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <button
                                type="button"
                                className="bg-white dark:bg-gray-700 py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                                onClick={() => window.location.reload()}
                                disabled={configLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="bg-primary-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleSaveConfiguration}
                                disabled={configLoading}
                            >
                                {configLoading ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* User Info Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Información del Usuario</h3>
                        </div>
                        <div className="px-6 py-4 space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-600">ID</label>
                                <p className="text-sm text-gray-900 font-mono">{user.id}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600">Email</label>
                                <p className="text-sm text-gray-900">{user.email}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600">Nombre</label>
                                <p className="text-sm text-gray-900">{user.name || 'No especificado'}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600">Plan</label>
                                <p className="text-sm text-gray-900 capitalize">{user.plan}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600">Fecha de Registro</label>
                                <p className="text-sm text-gray-900">{formatDate(user.created_at)}</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600">Última Actividad</label>
                                <p className="text-sm text-gray-900">
                                    {user.last_activity_at ? formatDate(user.last_activity_at) : 'Nunca'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white shadow rounded-lg">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Estado de la Cuenta</h3>
                        </div>
                        <div className="px-6 py-4 space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-600">Estado</label>
                                <p className="text-sm text-gray-900">
                                    {user.active ? 'Activa' : 'Inactiva'}
                                </p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-600">Suspendida</label>
                                <p className="text-sm text-gray-900">
                                    {user.suspended ? 'Sí' : 'No'}
                                </p>
                            </div>
                            {user.suspended && user.suspended_reason && (
                                <div>
                                    <label className="text-sm font-medium text-gray-600">Razón de Suspensión</label>
                                    <p className="text-sm text-gray-900">{user.suspended_reason}</p>
                                </div>
                            )}
                            <div>
                                <label className="text-sm font-medium text-gray-600">Es Admin</label>
                                <p className="text-sm text-gray-900">
                                    {user.is_admin ? 'Sí' : 'No'}
                                </p>
                            </div>
                        </div>
                    </div>
                
                    {/* Integrations Status */}
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Estado de Integraciones</h3>
                            <p className="text-sm text-gray-600">Cuentas conectadas y handles</p>
                        </div>
                        <div className="px-6 py-4">
                            {activity?.integrations_status?.length > 0 ? (
                                <div className="space-y-3">
                                    {activity.integrations_status.map((integration, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                            <div className="flex items-center space-x-3">
                                                <div className="flex-shrink-0">
                                                    <div className={`w-3 h-3 rounded-full ${
                                                        integration.status === 'connected' ? 'bg-green-500' : 
                                                        integration.status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                                                    }`}></div>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900 capitalize">{integration.platform}</p>
                                                    {integration.handle && (
                                                        <p className="text-sm text-gray-600">@{integration.handle}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500 capitalize">{integration.status}</p>
                                                {integration.last_sync_at && (
                                                    <p className="text-xs text-gray-400">
                                                        Última sync: {formatDate(integration.last_sync_at)}
                                                    </p>
                                                )}
                                                {integration.sync_error && (
                                                    <p className="text-xs text-red-500">Error: {integration.sync_error}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-sm text-gray-500">No hay integraciones configuradas</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-6">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Acciones Rápidas</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Operaciones administrativas sobre la cuenta del usuario</p>
                    </div>
                    <div className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-4 py-2 border border-blue-300 dark:border-blue-600 shadow-sm text-sm font-medium rounded-md text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleResetPassword}
                                disabled={actionLoading}
                            >
                                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Reset Password
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-4 py-2 border border-green-300 dark:border-green-600 shadow-sm text-sm font-medium rounded-md text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleReAuthIntegrations}
                                disabled={actionLoading}
                            >
                                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Re-auth Integraciones
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-4 py-2 border border-yellow-300 dark:border-yellow-600 shadow-sm text-sm font-medium rounded-md text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={user.suspended ? handleUnsuspend : handleSuspend}
                                disabled={actionLoading}
                            >
                                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.864-.833-2.634 0L4.268 14.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                {user.suspended ? 'Reactivar' : 'Suspender'}
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center px-4 py-2 border border-red-300 dark:border-red-600 shadow-sm text-sm font-medium rounded-md text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={handleDeleteAccount}
                                disabled={actionLoading}
                            >
                                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Eliminar Cuenta
                            </button>
                        </div>
                    </div>
                </div>

                {/* Detailed Activity Sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Recent Roasts */}
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Últimos Roasts Generados</h3>
                            <p className="text-sm text-gray-600">Últimas 10 respuestas generadas</p>
                        </div>
                        <div className="px-6 py-4">
                            {activity?.recent_roasts?.length > 0 ? (
                                <div className="space-y-4">
                                    {activity.recent_roasts.map((roast, index) => (
                                        <div key={roast.id || index} className="border border-gray-200 rounded-lg p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-900">Comentario Original:</p>
                                                    <p className="text-sm text-gray-600 mb-2 italic">"{roast.original_comment}"</p>
                                                    <p className="text-sm font-medium text-gray-900">Roast Generado:</p>
                                                    <p className="text-sm text-blue-600 font-medium">"{roast.roast_response}"</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                                                <div className="flex items-center space-x-3">
                                                    <span className="capitalize bg-gray-100 px-2 py-1 rounded">{roast.platform}</span>
                                                    {roast.toxicity_score && (
                                                        <span className={`px-2 py-1 rounded ${
                                                            roast.toxicity_score > 0.7 ? 'bg-red-100 text-red-800' :
                                                            roast.toxicity_score > 0.5 ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-green-100 text-green-800'
                                                        }`}>
                                                            Toxicidad: {(roast.toxicity_score * 100).toFixed(0)}%
                                                        </span>
                                                    )}
                                                </div>
                                                <span>{formatDate(roast.created_at)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-sm text-gray-500">No hay roasts generados recientemente</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Shield Intercepts */}
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Comentarios Interceptados por Shield</h3>
                            <p className="text-sm text-gray-600">Últimas 10 intervenciones del escudo</p>
                        </div>
                        <div className="px-6 py-4">
                            {activity?.shield_intercepts?.length > 0 ? (
                                <div className="space-y-4">
                                    {activity.shield_intercepts.map((intercept, index) => (
                                        <div key={intercept.id || index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <p className="text-sm font-medium text-gray-900">Comentario Interceptado:</p>
                                                    <p className="text-sm text-gray-700 mb-2 italic">"{intercept.comment_text}"</p>
                                                    <p className="text-sm font-medium text-gray-900">Acción Tomada:</p>
                                                    <p className="text-sm text-red-600 font-medium capitalize">{intercept.action_taken}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
                                                <div className="flex items-center space-x-3">
                                                    <span className="capitalize bg-white px-2 py-1 rounded border">{intercept.platform}</span>
                                                    {intercept.toxicity_score && (
                                                        <span className="bg-red-200 text-red-800 px-2 py-1 rounded">
                                                            Toxicidad: {(intercept.toxicity_score * 100).toFixed(0)}%
                                                        </span>
                                                    )}
                                                </div>
                                                <span>{formatDate(intercept.created_at)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <p className="text-sm text-gray-500">No hay interceptaciones de Shield recientes</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Legacy Recent Activities - Keep if stats.recent_activities exists */}
                {stats?.recent_activities && stats.recent_activities.length > 0 && (
                    <div className="bg-white shadow rounded-lg mb-6">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Otras Actividades Recientes</h3>
                            <p className="text-sm text-gray-600">Últimos 30 días - actividades generales</p>
                        </div>
                        <div className="px-6 py-4">
                            <div className="flow-root">
                                <ul className="-mb-8">
                                    {stats.recent_activities.slice(0, 5).map((activity, index) => (
                                        <li key={index}>
                                            <div className="relative pb-8">
                                                {index !== stats.recent_activities.slice(0, 5).length - 1 && (
                                                    <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" />
                                                )}
                                                <div className="relative flex space-x-3">
                                                    <div>
                                                        <span className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center ring-8 ring-white">
                                                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                            </svg>
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                                        <div>
                                                            <p className="text-sm text-gray-900">
                                                                {activity.activity_type.replace('_', ' ').toUpperCase()}
                                                                {activity.platform && (
                                                                    <span className="text-gray-600"> en {activity.platform}</span>
                                                                )}
                                                            </p>
                                                            {activity.tokens_used > 0 && (
                                                                <p className="text-xs text-gray-500">
                                                                    {activity.tokens_used} tokens utilizados
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                                            {formatDate(activity.created_at)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
        </>
    );
};

export default UserDetail;