import React from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { darkCyberTheme } from './darkCyberTheme';
import GlobalStyles from './globalStyles';

interface SnakeEaterThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps its children with the application's dark styled-components theme and injects global styles.
 *
 * @returns A React element that provides the `darkCyberTheme` via styled-components' ThemeProvider and renders `GlobalStyles` before `children`.
 */
export function SnakeEaterThemeProvider({ children }: SnakeEaterThemeProviderProps) {
  return (
    <StyledThemeProvider theme={darkCyberTheme}>
      <GlobalStyles />
      {children}
    </StyledThemeProvider>
  );
}