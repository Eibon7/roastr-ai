import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Pencil, 
  Puzzle, 
  CreditCard, 
  Settings, 
  FileText,
  Activity,
  Wand2,
  Crown,
  Cog,
  Eye,
  Menu,
  X,
  DollarSign
} from 'lucide-react';

const navItems = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
    description: 'Overview & widgets'
  },
  {
    name: 'Compose',
    path: '/compose',
    icon: Pencil,
    description: 'Roast preview sandbox'
  },
  {
    name: 'Integrations',
    path: '/integrations',
    icon: Puzzle,
    description: 'Platform connections'
  },
  {
    name: 'Configuration',
    path: '/configuration',
    icon: Cog,
    description: 'Platform settings'
  },
  {
    name: 'Approval',
    path: '/approval',
    icon: Eye,
    description: 'Review responses'
  },
  {
    name: 'Style Profile',
    path: '/style-profile',
    icon: Wand2,
    description: 'AI roast personality'
  },
  {
    name: 'Pricing',
    path: '/pricing',
    icon: DollarSign,
    description: 'Plans & pricing'
  },
  {
    name: 'Billing',
    path: '/billing',
    icon: CreditCard,
    description: 'Usage & billing'
  },
  {
    name: 'Settings',
    path: '/settings',
    icon: Settings,
    description: 'Feature flags & config'
  },
  {
    name: 'Logs',
    path: '/logs',
    icon: FileText,
    description: 'System activity'
  }
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
          className="fixed top-4 left-4 z-50 p-2 bg-card rounded-lg border border-border shadow-lg lg:hidden"
        >
          {isOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
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
        className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out z-30 overflow-hidden
          ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full p-4">
          <nav className="space-y-2 flex-1 overflow-y-auto">
            {navItems.map((item) => {
            const IconComponent = item.icon;
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={isMobile ? closeSidebar : undefined}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`
                }
              >
                <IconComponent className="h-5 w-5 flex-shrink-0" />
                <div className="flex flex-col">
                  <span>{item.name}</span>
                  <span className="text-xs opacity-75">{item.description}</span>
                </div>
              </NavLink>
            );
          })}
          </nav>

          {/* Footer with version info */}
          <div className="mt-4 flex-shrink-0">
            <div className="text-xs text-muted-foreground text-center p-2 bg-muted rounded-lg">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Activity className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">Mock Mode Active</span>
              </div>
              <div className="truncate">v1.0.0-dashboard</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}