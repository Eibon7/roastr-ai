/**
 * ShieldInterceptedList Component
 * 
 * Displays list of intercepted comments with filters, expandable content, and revert functionality
 */

import React, { useState } from 'react';

const ShieldInterceptedList = ({ 
  interceptedItems = [], 
  onRevertAction,
  loading = false,
  onRefresh
}) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [revertingActions, setRevertingActions] = useState(new Set());

  const categories = ['all', 'toxic', 'spam', 'harassment', 'hate_speech', 'inappropriate'];
  const timeRanges = [
    { value: '7d', label: 'Últimos 7 días' },
    { value: '30d', label: 'Últimos 30 días' },
    { value: '90d', label: 'Últimos 90 días' },
    { value: 'all', label: 'Todo el tiempo' }
  ];

  // Filter items by category and time range
  const filteredItems = interceptedItems.filter(item => {
    // Category filter
    const categoryMatch = selectedCategory === 'all' || item.reason === selectedCategory;
    
    // Time range filter
    if (selectedTimeRange === 'all') {
      return categoryMatch;
    }
    
    const itemDate = new Date(item.created_at);
    const now = new Date();
    let cutoffDate;
    
    switch (selectedTimeRange) {
      case '7d':
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        return categoryMatch;
    }
    
    return categoryMatch && itemDate >= cutoffDate;
  });

  const toggleExpanded = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const handleRevertAction = async (actionId, reason = '') => {
    if (!onRevertAction) return;
    
    setRevertingActions(prev => new Set(prev).add(actionId));
    
    try {
      await onRevertAction(actionId, reason);
      // Refresh the list if refresh handler is provided
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Failed to revert action:', error);
    } finally {
      setRevertingActions(prev => {
        const newSet = new Set(prev);
        newSet.delete(actionId);
        return newSet;
      });
    }
  };

  const getCategoryColor = (reason) => {
    switch (reason) {
      case 'toxic':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'harassment':
        return 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30';
      case 'hate_speech':
        return 'text-red-800 dark:text-red-200 bg-red-200 dark:bg-red-900/40';
      case 'spam':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
      case 'inappropriate':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getCategoryLabel = (reason) => {
    switch (reason) {
      case 'toxic':
        return 'Tóxico';
      case 'harassment':
        return 'Acoso';
      case 'hate_speech':
        return 'Discurso de odio';
      case 'spam':
        return 'Spam';
      case 'inappropriate':
        return 'Inapropiado';
      default:
        return reason;
    }
  };

  const getActionColor = (actionType) => {
    switch (actionType) {
      case 'block':
        return 'text-red-600 dark:text-red-400';
      case 'report':
        return 'text-red-700 dark:text-red-300';
      case 'mute':
        return 'text-orange-600 dark:text-orange-400';
      case 'flag':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getActionLabel = (actionType) => {
    switch (actionType) {
      case 'block':
        return 'Bloqueado';
      case 'report':
        return 'Reportado';
      case 'mute':
        return 'Silenciado';
      case 'flag':
        return 'Marcado';
      default:
        return actionType;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-3">
        {/* Category Filters */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Filtrar por categoría:
          </label>
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {category === 'all' ? 'Todos' : getCategoryLabel(category)}
                {category !== 'all' && (
                  <span className="ml-1 text-xs">
                    ({interceptedItems.filter(item => item.reason === category).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Time Range Filter */}
        <div className="flex items-center space-x-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Período de tiempo:
          </label>
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {timeRanges.map(range => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
          
          {/* Refresh Button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="text-sm px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? '🔄' : '↻'} Actualizar
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite] mb-4">
            <span className="sr-only">Cargando...</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400">Cargando eventos de Shield...</p>
        </div>
      )}
      
      {!loading && filteredItems.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-400 dark:text-gray-500 text-4xl mb-2">🛡️</div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {selectedCategory === 'all' 
              ? 'No hay comentarios interceptados en este período'
              : `No hay comentarios de tipo "${getCategoryLabel(selectedCategory)}" en este período`
            }
          </p>
        </div>
      )}
      
      {!loading && filteredItems.length > 0 && (
        <div className="space-y-3">
          {filteredItems.map(item => {
            const isExpanded = expandedItems.has(item.id);
            const isReverting = revertingActions.has(item.id);
            const isReverted = !!item.reverted_at;
            const categoryColor = getCategoryColor(item.reason);
            const actionColor = getActionColor(item.action_type);

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-gray-800 border rounded-lg p-4 ${
                  isReverted 
                    ? 'border-gray-300 dark:border-gray-600 opacity-70' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${categoryColor}`}>
                      {getCategoryLabel(item.reason)}
                    </span>
                    <span className={`text-xs font-medium ${actionColor}`}>
                      {getActionLabel(item.action_type)}
                    </span>
                    {isReverted && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                        Revertido
                      </span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {item.platform}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(item.created_at)}
                  </span>
                </div>

                {/* Content Snippet */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {item.content_snippet || '[Contenido no disponible]'}
                </p>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
                  >
                    {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                  </button>

                  {/* Revert Button - Only show if not reverted and revert handler is available */}
                  {!isReverted && onRevertAction && (
                    <button
                      onClick={() => handleRevertAction(item.id, 'Revertido desde UI de Shield')}
                      disabled={isReverting}
                      className="text-xs px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/40 rounded transition-colors disabled:opacity-50"
                    >
                      {isReverting ? '⏳ Revirtiendo...' : '↶ Revertir acción'}
                    </button>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">ID de acción:</p>
                        <p className="text-gray-600 dark:text-gray-400 font-mono text-xs">{item.id}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Hash del contenido:</p>
                        <p className="text-gray-600 dark:text-gray-400 font-mono text-xs">{item.content_hash?.substring(0, 16)}...</p>
                      </div>
                      {isReverted && (
                        <div className="md:col-span-2">
                          <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Revertido el:</p>
                          <p className="text-gray-600 dark:text-gray-400">{formatDate(item.reverted_at)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShieldInterceptedList;