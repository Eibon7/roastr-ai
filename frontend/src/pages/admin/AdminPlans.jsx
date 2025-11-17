import React, { useState, useEffect } from 'react';
import { apiClient } from '../../lib/api';

const AdminPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [alert, setAlert] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/plans');
      if (response.success) {
        setPlans(response.data.plans);
        setTotalUsers(response.data.totalUsers);
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
      setAlert({
        type: 'error',
        message: 'Error al cargar planes: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan) => {
    if (!plan.editable) return;
    setEditingPlan(plan.id);
    setEditValues({
      maxRoasts: plan.limits.roastsPerMonth,
      maxPlatforms: plan.limits.platforms,
      monthlyAnalysisLimit: plan.limits.analysisPerMonth,
      monthlyTokensLimit: plan.limits.tokensPerMonth,
      platformIntegrations: plan.limits.platforms // Same as maxPlatforms
    });
  };

  const handleCancelEdit = () => {
    setEditingPlan(null);
    setEditValues({});
  };

  const handleSave = async (planId) => {
    try {
      const response = await apiClient.put(`/admin/plans/${planId}`, editValues);
      if (response.success) {
        setAlert({
          type: 'success',
          message: 'Límites actualizados correctamente'
        });
        setEditingPlan(null);
        setEditValues({});
        await loadPlans(); // Reload to get updated data
      }
    } catch (error) {
      setAlert({
        type: 'error',
        message: 'Error al actualizar: ' + (error.message || 'Error desconocido')
      });
    }
  };

  const formatLimit = (value) => {
    if (value === -1) return 'Unlimited';
    if (value === null || value === undefined) return '-';
    return Number(value).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Gestión de Planes
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Administra los límites de cada plan sin necesidad de modificar código
        </p>
      </div>

      {alert && (
        <div className={`mb-6 p-4 rounded-lg ${
          alert.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
        }`}>
          <div className="flex justify-between items-center">
            <span>{alert.message}</span>
            <button
              onClick={() => setAlert(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Total de usuarios:</strong> {totalUsers}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Plan
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Precio
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Usuarios
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Roasts/mes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Plataformas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Análisis/mes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tokens/mes
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {plans.map((plan) => (
              <tr key={plan.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {plan.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {plan.id}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {plan.price === 0 ? 'Gratis' : `€${plan.price.toFixed(2)}`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  <span className="font-semibold">{plan.userCount}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {editingPlan === plan.id ? (
                    <input
                      type="number"
                      value={editValues.maxRoasts === -1 ? '' : editValues.maxRoasts}
                      onChange={(e) => setEditValues({
                        ...editValues,
                        maxRoasts: e.target.value === '' ? -1 : parseInt(e.target.value)
                      })}
                      placeholder="Unlimited = -1"
                      className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                    />
                  ) : (
                    formatLimit(plan.limits.roastsPerMonth)
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {editingPlan === plan.id ? (
                    <input
                      type="number"
                      value={editValues.maxPlatforms === -1 ? '' : editValues.maxPlatforms}
                      onChange={(e) => setEditValues({
                        ...editValues,
                        maxPlatforms: e.target.value === '' ? -1 : parseInt(e.target.value)
                      })}
                      placeholder="Unlimited = -1"
                      className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                    />
                  ) : (
                    formatLimit(plan.limits.platforms)
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {editingPlan === plan.id ? (
                    <input
                      type="number"
                      value={editValues.monthlyAnalysisLimit === -1 ? '' : editValues.monthlyAnalysisLimit}
                      onChange={(e) => setEditValues({
                        ...editValues,
                        monthlyAnalysisLimit: e.target.value === '' ? -1 : parseInt(e.target.value)
                      })}
                      placeholder="Unlimited = -1"
                      className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                    />
                  ) : (
                    formatLimit(plan.limits.analysisPerMonth)
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {editingPlan === plan.id ? (
                    <input
                      type="number"
                      value={editValues.monthlyTokensLimit === -1 ? '' : editValues.monthlyTokensLimit}
                      onChange={(e) => setEditValues({
                        ...editValues,
                        monthlyTokensLimit: e.target.value === '' ? -1 : parseInt(e.target.value)
                      })}
                      placeholder="Unlimited = -1"
                      className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
                    />
                  ) : (
                    formatLimit(plan.limits.tokensPerMonth)
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {editingPlan === plan.id ? (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSave(plan.id)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEdit(plan)}
                      disabled={!plan.editable}
                      className={`${
                        plan.editable
                          ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300'
                          : 'text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {plan.editable ? 'Editar' : 'No editable'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          <strong>Nota:</strong> Los cambios se guardan en la base de datos y sobrescriben los valores por defecto de planService.js.
          Usa -1 para límites ilimitados.
        </p>
      </div>
    </div>
  );
};

export default AdminPlans;

