import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WIDGETS, DEFAULT_LAYOUT, WIDGET_CONFIGS } from '../components/widgets';

export default function Dashboard() {
  const [adminMode, setAdminMode] = useState(false);
  const [adminModeUser, setAdminModeUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Check for admin mode on component mount - Issue #240
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const isAdminMode = urlParams.get('adminMode') === 'true';
    const sessionAdminMode = sessionStorage.getItem('adminMode') === 'true';
    const sessionAdminUser = sessionStorage.getItem('adminModeUser');

    if (isAdminMode || sessionAdminMode) {
      setAdminMode(true);
      if (sessionAdminUser) {
        try {
          setAdminModeUser(JSON.parse(sessionAdminUser));
        } catch (error) {
          console.error('Error parsing admin mode user:', error);
          setAdminModeUser(null);
        }
      }
    }
  }, [location]);

  const handleExitAdminMode = () => {
    // Clear admin mode from session storage
    sessionStorage.removeItem('adminMode');
    sessionStorage.removeItem('adminModeUser');
    setAdminMode(false);
    setAdminModeUser(null);
    
    // Navigate back to admin panel
    navigate('/admin/users');
  };

  return (
    <div className="space-y-6">
      {/* Admin Mode Banner - Issue #240 */}
      {adminMode && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-400 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300">
                  Modo Administrador Activo
                </h3>
                <p className="mt-1 text-sm text-orange-700 dark:text-orange-400">
                  {adminModeUser ? (
                    <>
                      Viendo dashboard de: <strong>{adminModeUser.name || adminModeUser.email}</strong> ({adminModeUser.plan})
                    </>
                  ) : (
                    'Visualizando dashboard de usuario como administrador'
                  )}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={handleExitAdminMode}
                className="bg-orange-50 dark:bg-orange-900/20 rounded-md p-2 inline-flex items-center justify-center text-orange-400 hover:text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-orange-500 transition-colors"
              >
                <span className="sr-only">Salir del modo administrador</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="mt-3 flex">
            <button
              onClick={handleExitAdminMode}
              className="bg-orange-100 dark:bg-orange-900/40 hover:bg-orange-200 dark:hover:bg-orange-900/60 text-orange-800 dark:text-orange-300 px-4 py-2 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
            >
              ← Volver al Panel de Admin
            </button>
          </div>
        </div>
      )}

      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {adminMode && adminModeUser ? `Dashboard de ${adminModeUser.name || adminModeUser.email}` : 'Dashboard'}
          </h1>
          <p className="text-muted-foreground">
            Monitor your roast bot performance and system health
          </p>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DEFAULT_LAYOUT.map((widgetKey) => {
          const WidgetComponent = WIDGETS[widgetKey];
          const config = WIDGET_CONFIGS[widgetKey];
          
          if (!WidgetComponent) {
            console.warn(`Widget '${widgetKey}' not found`);
            return null;
          }

          return (
            <div key={widgetKey} className={config?.gridCols || 'md:col-span-1'}>
              <WidgetComponent />
            </div>
          );
        })}
      </div>
    </div>
  );
}