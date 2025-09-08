import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  Settings,
  ShoppingBag,
  Menu,
  X
} from 'lucide-react';
import useFeatureFlags from '../hooks/useFeatureFlags';

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
    requiresFlag: 'ENABLE_SHOP'
  }
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { isEnabled } = useFeatureFlags();

  // Build navigation items based on feature flags
  const navItems = [
    ...baseNavItems,
    ...conditionalNavItems.filter(item =>
      !item.requiresFlag || isEnabled(item.requiresFlag)
    )
  ];

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsOpen(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const closeSidebar = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg border border-gray-200 shadow-lg lg:hidden"
          aria-label="Toggle sidebar"
        >
          {isOpen ? <X className="h-5 w-5 text-gray-600" /> : <Menu className="h-5 w-5 text-gray-600" />}
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
        className={`fixed left-0 top-0 h-screen w-16 bg-gray-50 border-r border-gray-200 transform transition-transform duration-300 ease-in-out z-30 overflow-hidden
          ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">R</span>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4">
            <div className="space-y-2 px-2">
              {navItems.map((item) => {
                const IconComponent = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={isMobile ? closeSidebar : undefined}
                    className={({ isActive }) =>
                      `flex items-center justify-center w-12 h-12 rounded-lg transition-colors group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                        isActive
                          ? 'bg-gray-900 text-white'
                          : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                      }`
                    }
                    aria-label={item.name}
                  >
                    <IconComponent className="h-5 w-5" />

                    {/* Tooltip */}
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50" aria-hidden="true">
                      {item.name}
                    </div>
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