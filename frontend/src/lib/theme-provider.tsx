/**
 * Theme Provider Component
 *
 * Provides theme context for the entire application using next-themes.
 * Supports light, dark, and system themes with persistence.
 */

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * Props for ThemeProvider component
 */
type ThemeProviderProps = {
  /** Child components that will have access to theme context */
  children: React.ReactNode;
  /** Default theme to use ('light', 'dark', or 'system') */
  defaultTheme?: string;
  /** Key for localStorage persistence */
  storageKey?: string;
};

/**
 * ThemeProvider Component
 *
 * Wraps the application with theme context, enabling theme switching
 * and persistence across page reloads.
 *
 * @param props - ThemeProvider configuration props
 * @param props.children - Child components
 * @param props.defaultTheme - Initial theme (default: 'system')
 * @param props.storageKey - localStorage key for theme persistence
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'roastr-theme',
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      storageKey={storageKey}
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
