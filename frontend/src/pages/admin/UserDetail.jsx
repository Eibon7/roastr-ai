import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

const UserDetail = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

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
    }, [userId, isAdmin]);

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
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-6">
                    <nav className="flex" aria-label="Breadcrumb">
                        <ol className="flex items-center space-x-4">
                            <li>
                                <Link to="/admin" className="text-gray-500 hover:text-gray-700">
                                    Panel de Administración
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

                {/* User Info Details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Información del Usuario</h3>
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
                </div>

                {/* Recent Activities */}
                {stats.recent_activities && stats.recent_activities.length > 0 && (
                    <div className="bg-white shadow rounded-lg">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-medium text-gray-900">Actividades Recientes</h3>
                            <p className="text-sm text-gray-600">Últimos 30 días</p>
                        </div>
                        <div className="px-6 py-4">
                            <div className="flow-root">
                                <ul className="-mb-8">
                                    {stats.recent_activities.map((activity, index) => (
                                        <li key={index}>
                                            <div className="relative pb-8">
                                                {index !== stats.recent_activities.length - 1 && (
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
            </div>
        </div>
    );
};

export default UserDetail;