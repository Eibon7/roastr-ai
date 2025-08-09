import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Pencil, 
  Puzzle, 
  CreditCard, 
  Settings, 
  FileText,
  Activity 
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
    name: 'Billing',
    path: '/billing',
    icon: CreditCard,
    description: 'Plans & usage'
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
  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-card border-r border-border p-4">
      <nav className="space-y-2">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
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
      <div className="absolute bottom-4 left-4 right-4">
        <div className="text-xs text-muted-foreground text-center p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-center space-x-1 mb-1">
            <Activity className="h-3 w-3" />
            <span>Mock Mode Active</span>
          </div>
          <div>v1.0.0-dashboard</div>
        </div>
      </div>
    </aside>
  );
}