import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid,
  Settings,
  ShoppingBag,
  Menu,
  X,
  Flame
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
  // Force refresh - red sidebar with icons only

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
        className={`fixed left-0 top-0 h-screen w-20 bg-red-600 transform transition-transform duration-300 ease-in-out z-30 overflow-hidden
          ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
        `}
        style={{ backgroundColor: '#E02025' }}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-20 border-b border-red-500 border-opacity-30">
            <div className="flex items-center justify-center">
              <Flame className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-6">
            <div className="space-y-3 px-3">
              {navItems.map((item) => {
                const IconComponent = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={isMobile ? closeSidebar : undefined}
                    className={({ isActive }) =>
                      `flex items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-red-600 ${
                        isActive
                          ? 'bg-white bg-opacity-20 text-white shadow-lg'
                          : 'text-white text-opacity-70 hover:bg-white hover:bg-opacity-10 hover:text-white'
                      }`
                    }
                    aria-label={item.name}
                  >
                    <IconComponent className="h-6 w-6" />

                    {/* Tooltip */}
                    <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg" aria-hidden="true">
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