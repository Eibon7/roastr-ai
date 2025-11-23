/**
 * Admin Panel: Roast Tones Management
 *
 * Manage dynamic roast tone configuration from admin panel.
 *
 * Issue #876: Dynamic Roast Tone Configuration System
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authHelpers } from '../../lib/supabaseClient';
import { apiClient } from '../../lib/api';
import TonesList from '../../components/admin/TonesList';
import ToneEditor from '../../components/admin/ToneEditor';

const RoastTones = () => {
  const [tones, setTones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTone, setEditingTone] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    active: 'all', // all, active, inactive
    language: 'es' // es, en
  });

  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminAndLoadTones = async () => {
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
        await loadTones();
      } catch (error) {
        console.error('Admin check error:', error);
        navigate('/dashboard');
      }
    };

    checkAdminAndLoadTones();
  }, [navigate]);

  const loadTones = async () => {
    try {
      setLoading(true);

      const data = await apiClient.get('/admin/tones');

      if (data.success) {
        setTones(data.data);
      } else {
        showAlert('error', 'Error al cargar tonos');
      }
    } catch (error) {
      console.error('Error loading tones:', error);
      showAlert('error', error.message || 'Error al cargar tonos');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 5000);
  };

  const handleCreateTone = () => {
    setEditingTone(null);
    setIsEditorOpen(true);
  };

  const handleEditTone = (tone) => {
    setEditingTone(tone);
    setIsEditorOpen(true);
  };

  const handleSaveTone = async (toneData) => {
    try {
      if (editingTone) {
        // Update existing tone
        const data = await apiClient.put(`/admin/tones/${editingTone.id}`, toneData);

        if (data.success) {
          showAlert('success', 'Tono actualizado correctamente');
          await loadTones();
          setIsEditorOpen(false);
        } else {
          showAlert('error', data.error || 'Error al actualizar tono');
        }
      } else {
        // Create new tone
        const data = await apiClient.post('/admin/tones', toneData);

        if (data.success) {
          showAlert('success', 'Tono creado correctamente');
          await loadTones();
          setIsEditorOpen(false);
        } else {
          showAlert('error', data.error || 'Error al crear tono');
        }
      }
    } catch (error) {
      console.error('Error saving tone:', error);
      showAlert('error', error.message || 'Error al guardar tono');
    }
  };

  const handleDeleteTone = async (toneId) => {
    if (!window.confirm('¿Estás seguro de eliminar este tono? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const data = await apiClient.delete(`/admin/tones/${toneId}`);

      if (data.success) {
        showAlert('success', 'Tono eliminado correctamente');
        await loadTones();
      } else {
        showAlert('error', data.error || 'Error al eliminar tono');
      }
    } catch (error) {
      console.error('Error deleting tone:', error);
      showAlert('error', error.message || 'No se puede eliminar el último tono activo');
    }
  };

  const handleToggleActive = async (tone) => {
    try {
      const endpoint = tone.active
        ? `/admin/tones/${tone.id}/deactivate`
        : `/admin/tones/${tone.id}/activate`;

      const data = await apiClient.post(endpoint);

      if (data.success) {
        showAlert('success', `Tono ${tone.active ? 'desactivado' : 'activado'} correctamente`);
        await loadTones();
      } else {
        showAlert('error', data.error || 'Error al cambiar estado');
      }
    } catch (error) {
      console.error('Error toggling tone:', error);
      showAlert('error', error.message || 'No se puede desactivar el último tono activo');
    }
  };

  const handleReorder = async (reorderedTones) => {
    try {
      const orderArray = reorderedTones.map((tone, index) => ({
        id: tone.id,
        sort_order: index + 1
      }));

      const data = await apiClient.put('/admin/tones/reorder', { orderArray });

      if (data.success) {
        showAlert('success', 'Orden actualizado correctamente');
        await loadTones();
      } else {
        showAlert('error', data.error || 'Error al reordenar tonos');
      }
    } catch (error) {
      console.error('Error reordering tones:', error);
      showAlert('error', error.message || 'Error al reordenar tonos');
    }
  };

  const filteredTones = tones.filter((tone) => {
    // Filter by search
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const nameMatch = tone.name.toLowerCase().includes(searchLower);
      const displayNameES = tone.display_name?.es?.toLowerCase().includes(searchLower) || false;
      const displayNameEN = tone.display_name?.en?.toLowerCase().includes(searchLower) || false;

      if (!nameMatch && !displayNameES && !displayNameEN) {
        return false;
      }
    }

    // Filter by active status
    if (filters.active === 'active' && !tone.active) return false;
    if (filters.active === 'inactive' && tone.active) return false;

    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Gestión de Tonos de Roast
          </h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Configura los tonos de roast disponibles en el sistema. Los cambios se aplican
            inmediatamente.
          </p>
        </div>
        <button
          onClick={handleCreateTone}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Tono
        </button>
      </div>

      {/* Alert */}
      {alert && (
        <div
          className={`mb-6 rounded-md p-4 ${
            alert.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}
        >
          <div className="flex">
            <div className="flex-shrink-0">
              {alert.type === 'success' ? (
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{alert.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="search"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Buscar
          </label>
          <input
            type="text"
            id="search"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Buscar por nombre..."
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="active"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Estado
          </label>
          <select
            id="active"
            value={filters.active}
            onChange={(e) => setFilters({ ...filters, active: e.target.value })}
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="language"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Idioma
          </label>
          <select
            id="language"
            value={filters.language}
            onChange={(e) => setFilters({ ...filters, language: e.target.value })}
            className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm"
          >
            <option value="es">🇪🇸 Español</option>
            <option value="en">🇬🇧 English</option>
          </select>
        </div>
      </div>

      {/* Tones List */}
      <TonesList
        tones={filteredTones}
        language={filters.language}
        onEdit={handleEditTone}
        onDelete={handleDeleteTone}
        onToggleActive={handleToggleActive}
        onReorder={handleReorder}
      />

      {/* Tone Editor Modal */}
      {isEditorOpen && (
        <ToneEditor
          tone={editingTone}
          onSave={handleSaveTone}
          onClose={() => setIsEditorOpen(false)}
        />
      )}
    </div>
  );
};

export default RoastTones;
