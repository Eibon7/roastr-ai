import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutGrid, Settings, ShoppingBag, Menu, X, Flame, BarChart3 } from 'lucide-react';
import useFeatureFlags from '../hooks/useFeatureFlags';
import { useSidebar } from '../contexts/SidebarContext';

// Base navigation items (always visible)
const baseNavItems = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: LayoutGrid
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: Settings
  }
];

// Conditional navigation items
const conditionalNavItems = [
  {
    name: 'Shop',
    path: '/shop',
    icon: ShoppingBag,
    requiresFlag: ['ENABLE_SHOP', 'shop_enabled'] // Support both flag names
  },
  {
    name: 'Analytics',
    path: '/dashboard/analytics',
    icon: BarChart3,
    requiresFlag: 'ENABLE_ANALYTICS_UI'
  }
];

export default function Sidebar() {
  const { isOpen, isMobile, toggleSidebar, closeSidebar } = useSidebar();
  const { isEnabled } = useFeatureFlags();
  // Force refresh - red sidebar with icons only

  // Build navigation items based on feature flags
  const navItems = [
    ...baseNavItems,
    ...conditionalNavItems.filter((item) => {
      if (!item.requiresFlag) return true;

      // Support both single flag name and array of flag names
      if (Array.isArray(item.requiresFlag)) {
        return item.requiresFlag.some((flag) => isEnabled(flag));
      }

      return isEnabled(item.requiresFlag);
    })
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          type="button"
          onClick={toggleSidebar}
          aria-controls="app-sidebar"
          aria-expanded={isOpen}
          className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg border border-gray-200 shadow-lg lg:hidden"
          aria-label="Toggle sidebar"
        >
          {isOpen ? (
            <X className="h-5 w-5 text-gray-600" />
          ) : (
            <Menu className="h-5 w-5 text-gray-600" />
          )}
        </button>
      )}

      {/* Backdrop for mobile */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        id="app-sidebar"
        aria-hidden={isMobile && !isOpen}
        inert={isMobile && !isOpen ? '' : undefined}
        className={`roastr-sidebar fixed left-0 top-0 h-screen w-16 transform transition-transform duration-300 ease-in-out z-40 overflow-hidden
          ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-20 roastr-sidebar__logo">
            <Flame className="w-8 h-8 text-white" />
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6">
            <div className="space-y-3 px-2">
              {navItems.map((item) => {
                const IconComponent = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={isMobile ? closeSidebar : undefined}
                    className={({ isActive }) =>
                      `roastr-sidebar-nav-item flex items-center justify-center w-12 h-12 group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 ${
                        isActive ? 'active text-white' : 'text-white/70 hover:text-white'
                      }`
                    }
                    aria-label={item.name}
                  >
                    <IconComponent className="h-6 w-6" />
                  </NavLink>
                );
              })}
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
}
