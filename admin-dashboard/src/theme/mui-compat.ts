/**
 * MUI Theme Compatibility Layer
 *
 * Temporary shim to maintain compatibility with non-migrated components
 * that still access MUI theme properties (theme.colors, theme.spacing, etc.)
 *
 * This allows the build to succeed while we complete the migration in Phase 2.
 *
 * TODO: Remove this file once all components are migrated to shadcn/Tailwind
 * Tracked in: Epic #1032 Phase 2
 */

// Map MUI theme colors to CSS variables
const getCSSVar = (varName: string): string => {
  if (typeof window === 'undefined') return '#000000'; // SSR fallback
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
};

export const theme = {
  colors: {
    background: {
      default: 'var(--background)',
      paper: 'var(--card)'
    },
    primary: {
      main: 'var(--primary)',
      light: 'var(--primary)',
      dark: 'var(--primary)',
      contrastText: 'var(--primary-foreground)'
    },
    secondary: {
      main: 'var(--secondary)',
      light: 'var(--secondary)',
      dark: 'var(--secondary)',
      contrastText: 'var(--secondary-foreground)'
    },
    text: {
      primary: 'var(--foreground)',
      secondary: 'var(--muted-foreground)',
      disabled: 'var(--muted-foreground)'
    },
    border: 'var(--border)',
    divider: 'var(--border)',
    // Legacy colors for non-migrated components
    success: '#50fa7b',
    warning: '#f1fa8c',
    error: '#ff5555',
    info: '#8be9fd'
  },

  // MUI spacing function: spacing(n) returns n * 8px
  spacing: (factor: number): string => `${factor * 8}px`,

  // Border radius
  borderRadius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    xl: 'var(--radius-xl)'
  },

  // Typography
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: {
      xs: '0.75rem', // 12px
      sm: '0.875rem', // 14px
      md: '1rem', // 16px
      lg: '1.125rem', // 18px
      xl: '1.25rem' // 20px
    },
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
  },

  // Animations/transitions
  animations: {
    duration: {
      short: '150ms',
      medium: '300ms',
      long: '500ms'
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)'
    }
  }
};

// Type for the compatibility theme
export type MUICompatTheme = typeof theme;

// Default export for components that import { theme }
export default theme;
