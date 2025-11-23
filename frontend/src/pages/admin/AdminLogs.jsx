import React from 'react';

const AdminLogs = () => {
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-4 text-xl font-medium text-gray-900 dark:text-white">
          Logs / Alertas - Próximamente
        </h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Esta sección incluirá logs del sistema, alertas de uso, monitoreo de errores y
          herramientas de diagnóstico.
        </p>
        <div className="mt-8 space-y-4 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                <span className="text-gray-500 dark:text-gray-400 text-sm font-mono">
                  [--:--:--] [INFO] [system]
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  Sistema operando normalmente
                </span>
              </div>
              <span className="text-gray-400 dark:text-gray-500 text-xs">placeholder</span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 bg-yellow-400 rounded-full"></div>
                <span className="text-gray-500 dark:text-gray-400 text-sm font-mono">
                  [--:--:--] [WARN] [usage]
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  Usuario cerca del límite mensual
                </span>
              </div>
              <span className="text-gray-400 dark:text-gray-500 text-xs">placeholder</span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 bg-red-400 rounded-full"></div>
                <span className="text-gray-500 dark:text-gray-400 text-sm font-mono">
                  [--:--:--] [ERROR] [integration]
                </span>
                <span className="text-gray-600 dark:text-gray-300">
                  Error en integración de Twitter
                </span>
              </div>
              <span className="text-gray-400 dark:text-gray-500 text-xs">placeholder</span>
            </div>
          </div>
        </div>
        <div className="mt-8">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 max-w-md mx-auto">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700 dark:text-yellow-200">
                  <strong>En desarrollo:</strong> Esta funcionalidad será implementada en futuras
                  versiones.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogs;
