import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Shield, 
  CheckCircle, 
  Users,
  Settings 
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Shield Settings',
    href: '/shield/settings',
    icon: Shield,
  },
  {
    title: 'Shield Validation',
    href: '/shield/validation',
    icon: CheckCircle,
  },
  {
    title: 'Workers',
    href: '/admin/workers',
    icon: Users,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

/**
 * MainNav - Navegación principal del sidebar (desktop)
 * 
 * Muestra links con iconos y activos según ruta actual
 */
export function MainNav() {
  const location = useLocation();

  return (
    <nav className="flex flex-col gap-2 px-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;

        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

