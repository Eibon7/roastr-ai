/**
 * Admin Component: Tones List
 * 
 * Displays tones in a table with drag & drop reordering.
 * 
 * Issue #876: Dynamic Roast Tone Configuration System
 */

import React, { useState } from 'react';

const TonesList = ({ tones, language, onEdit, onDelete, onToggleActive, onReorder }) => {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    setHoveredIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && hoveredIndex !== null && draggedIndex !== hoveredIndex) {
      const reorderedTones = [...tones];
      const [draggedTone] = reorderedTones.splice(draggedIndex, 1);
      reorderedTones.splice(hoveredIndex, 0, draggedTone);
      
      onReorder(reorderedTones);
    }
    
    setDraggedIndex(null);
    setHoveredIndex(null);
  };

  const getIntensityColor = (intensity) => {
    if (intensity <= 2) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    if (intensity === 3) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  };

  const getIntensityLabel = (intensity) => {
    const labels = {
      1: '⭐',
      2: '⭐⭐',
      3: '⭐⭐⭐',
      4: '⭐⭐⭐⭐',
      5: '⭐⭐⭐⭐⭐'
    };
    return labels[intensity] || '';
  };

  if (tones.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          No hay tonos
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {language === 'es' 
            ? 'Crea tu primer tono para empezar.'
            : 'Create your first tone to get started.'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
      <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th scope="col" className="w-12 px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
              Nombre
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
              Descripción
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
              Intensidad
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
              Estado
            </th>
            <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-white">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
          {tones.map((tone, index) => (
            <tr
              key={tone.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`
                transition-colors cursor-move
                ${draggedIndex === index ? 'opacity-50' : ''}
                ${hoveredIndex === index && draggedIndex !== null ? 'bg-red-50 dark:bg-red-900/10' : ''}
                hover:bg-gray-50 dark:hover:bg-gray-800
              `}
            >
              {/* Drag handle */}
              <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </td>

              {/* Name */}
              <td className="px-3 py-4 text-sm">
                <div className="font-medium text-gray-900 dark:text-white">
                  {tone.display_name?.[language] || tone.display_name?.es || tone.name}
                </div>
                <div className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  ID: {tone.name}
                  {tone.is_default && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                      Predeterminado
                    </span>
                  )}
                </div>
              </td>

              {/* Description */}
              <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                <div className="truncate">
                  {tone.description?.[language] || tone.description?.es || '-'}
                </div>
              </td>

              {/* Intensity */}
              <td className="px-3 py-4 text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getIntensityColor(tone.intensity)}`}>
                  {getIntensityLabel(tone.intensity)} {tone.intensity}/5
                </span>
              </td>

              {/* Status */}
              <td className="px-3 py-4 text-sm">
                {tone.active ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                    ● Activo
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                    ○ Inactivo
                  </span>
                )}
              </td>

              {/* Actions */}
              <td className="px-3 py-4 text-sm text-right space-x-2">
                <button
                  onClick={() => onToggleActive(tone)}
                  className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                  title={tone.active ? 'Desactivar' : 'Activar'}
                >
                  {tone.active ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={() => onEdit(tone)}
                  className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                  title="Editar"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                <button
                  onClick={() => onDelete(tone.id)}
                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                  title="Eliminar"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Help text */}
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
        <strong>💡 Tip:</strong> Arrastra y suelta para reordenar los tonos. El orden determina cómo aparecen en la selección.
      </div>
    </div>
  );
};

export default TonesList;

