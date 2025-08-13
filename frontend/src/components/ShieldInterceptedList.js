/**
 * ShieldInterceptedList Component
 * 
 * Displays list of intercepted comments with filters and expandable content
 */

import React, { useState } from 'react';

const ShieldInterceptedList = ({ interceptedItems = [] }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedItems, setExpandedItems] = useState(new Set());

  const categories = ['all', 'Insultos graves', 'Amenazas', 'Otros'];

  const filteredItems = interceptedItems.filter(item => 
    selectedCategory === 'all' || item.category === selectedCategory
  );

  const toggleExpanded = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Insultos graves':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'Amenazas':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
      case 'Otros':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'Reportar':
        return 'text-red-600 dark:text-red-400';
      case 'Ocultar comentario':
        return 'text-orange-600 dark:text-orange-400';
      case 'Silenciar autor':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
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
            {category === 'all' ? 'Todos' : category}
            {category !== 'all' && (
              <span className="ml-1 text-xs">
                ({interceptedItems.filter(item => item.category === category).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 dark:text-gray-500 text-4xl mb-2">🛡️</div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {selectedCategory === 'all' 
              ? 'No hay comentarios interceptados'
              : `No hay comentarios de tipo "${selectedCategory}"`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map(item => {
            const isExpanded = expandedItems.has(item.id);
            const categoryColor = getCategoryColor(item.category);
            const actionColor = getActionColor(item.action);

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${categoryColor}`}>
                      {item.category}
                    </span>
                    <span className={`text-xs font-medium ${actionColor}`}>
                      {item.action}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {formatDate(item.createdAt)}
                  </span>
                </div>

                {/* Preview */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {item.preview}
                </p>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded p-3 mb-3">
                    <p className="text-sm text-red-800 dark:text-red-300 font-medium mb-1">
                      Contenido original:
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      {item.originalHidden}
                    </p>
                  </div>
                )}

                {/* Toggle Button */}
                <button
                  onClick={() => toggleExpanded(item.id)}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
                >
                  {isExpanded ? 'Ocultar comentario original' : 'Ver comentario original'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShieldInterceptedList;