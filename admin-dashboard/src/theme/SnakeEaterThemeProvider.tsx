import React from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { darkCyberTheme } from './darkCyberTheme';
import GlobalStyles from './globalStyles';

interface SnakeEaterThemeProviderProps {
  children: React.ReactNode;
}

export function SnakeEaterThemeProvider({ children }: SnakeEaterThemeProviderProps) {
  return (
    <StyledThemeProvider theme={darkCyberTheme}>
      <GlobalStyles />
      {children}
    </StyledThemeProvider>
  );
}
