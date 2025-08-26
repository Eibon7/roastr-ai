import React from 'react';

const AdminMetrics = () => {
  return (
    <div className="min-h-full">
      <div className="text-center py-12">
        <svg
          className="mx-auto h-24 w-24 text-gray-400 dark:text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-white">
          Métricas - Próximamente
        </h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Esta sección incluirá métricas avanzadas del sistema, análisis de uso, estadísticas de rendimiento y dashboards ejecutivos.
        </p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">--</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">Usuarios Activos</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">--</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">Roasts Generados</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-400 dark:text-gray-500">--</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">Ingresos Mensuales</div>
          </div>
        </div>
        <div className="mt-8">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 max-w-md mx-auto">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700 dark:text-yellow-200">
                  <strong>En desarrollo:</strong> Esta funcionalidad será implementada en futuras versiones.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMetrics;