/**
 * Snake Eater UI - Dark Cyber Theme
 * Metal Gear Solid Codec Screen Inspired
 *
 * @GDD:node=roast,shield,queue-system,multi-tenant
 */

import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    colors: {
      // Primary (Status Indicators)
      primary: string;
      secondary: string;

      // Backgrounds
      background: string;
      surface: string;
      surfaceHover: string;
      overlay: string;

      // Text
      textPrimary: string;
      textSecondary: string;
      textDisabled: string;
      textInverse: string;

      // Status Colors
      statusHealthy: string;
      statusWarning: string;
      statusCritical: string;

      // Drift Risk
      driftHealthy: string;
      driftAtRisk: string;
      driftCritical: string;

      // Coverage
      coverageHigh: string;
      coverageMedium: string;
      coverageLow: string;

      // Accents
      accentPrimary: string;
      accentSecondary: string;
      accentTertiary: string;

      // State Colors
      stateSuccess: string;
      stateInfo: string;
      stateWarning: string;
      stateError: string;

      // UI Elements
      border: string;
      borderFocus: string;
      borderError: string;
      divider: string;

      // Links
      linkDefault: string;
      linkHover: string;

      // Syntax Highlighting
      syntaxBg: string;
      syntaxKeyword: string;
      syntaxString: string;
      syntaxFunction: string;
      syntaxComment: string;
      syntaxVariable: string;
    };

    typography: {
      fontFamily: {
        primary: string;
        secondary: string;
      };
      fontSize: {
        xs: string;
        sm: string;
        md: string;
        lg: string;
        xl: string;
        '2xl': string;
        '3xl': string;
        h1: string;
        h2: string;
        h3: string;
        h4: string;
      };
      fontWeight: {
        regular: number;
        medium: number;
        semibold: number;
        bold: number;
      };
      lineHeight: {
        tight: number;
        normal: number;
        relaxed: number;
      };
    };

    spacing: (factor: number) => string;

    borderRadius: {
      none: string;
      sm: string;
      md: string;
      lg: string;
    };

    shadows: {
      sm: string;
      md: string;
      lg: string;
      glow: string;
    };

    animations: {
      glitch: string;
      fadeIn: string;
      slideIn: string;
    };
  }
}

export interface Theme {
  colors: {
    // Primary (Status Indicators)
    primary: string;
    secondary: string;

    // Backgrounds
    background: string;
    surface: string;
    surfaceHover: string;
    overlay: string;

    // Text
    textPrimary: string;
    textSecondary: string;
    textDisabled: string;
    textInverse: string;

    // Status Colors
    statusHealthy: string;
    statusWarning: string;
    statusCritical: string;

    // Drift Risk
    driftHealthy: string;
    driftAtRisk: string;
    driftCritical: string;

    // Coverage
    coverageHigh: string;
    coverageMedium: string;
    coverageLow: string;

    // Accents
    accentPrimary: string;
    accentSecondary: string;
    accentTertiary: string;

    // State Colors
    stateSuccess: string;
    stateInfo: string;
    stateWarning: string;
    stateError: string;

    // UI Elements
    border: string;
    borderFocus: string;
    borderError: string;
    divider: string;

    // Links
    linkDefault: string;
    linkHover: string;

    // Syntax Highlighting
    syntaxBg: string;
    syntaxKeyword: string;
    syntaxString: string;
    syntaxFunction: string;
    syntaxComment: string;
    syntaxVariable: string;
  };

  typography: {
    fontFamily: {
      primary: string;
      secondary: string;
    };
    fontSize: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
      h1: string;
      h2: string;
      h3: string;
      h4: string;
    };
    fontWeight: {
      regular: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };

  spacing: (factor: number) => string;

  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
  };

  shadows: {
    sm: string;
    md: string;
    lg: string;
    glow: string;
  };

  animations: {
    glitch: string;
    fadeIn: string;
    slideIn: string;
  };
}

export const darkCyberTheme: Theme = {
  colors: {
    // Primary
    primary: '#00FF41',        // Matrix green
    secondary: '#FF006E',      // Neon pink

    // Backgrounds
    background: '#0A0E14',     // Deep space blue-black
    surface: '#151921',        // Elevated surface
    surfaceHover: '#1F2430',   // Hover state
    overlay: 'rgba(10, 14, 20, 0.95)',

    // Text
    textPrimary: '#E5E9F0',
    textSecondary: '#A0A8B7',
    textDisabled: '#5A6375',
    textInverse: '#0A0E14',

    // Status Colors (Health)
    statusHealthy: '#00FF41',  // Green
    statusWarning: '#FFB800',  // Amber
    statusCritical: '#FF3B3B', // Red

    // Drift Risk
    driftHealthy: '#00C9A7',   // Teal
    driftAtRisk: '#FFB800',    // Amber
    driftCritical: '#FF6B6B',  // Coral red

    // Coverage
    coverageHigh: '#00D9FF',   // Cyan
    coverageMedium: '#8B9FDE', // Lavender
    coverageLow: '#A78BFA',    // Purple

    // Accents
    accentPrimary: '#00FF41',
    accentSecondary: '#00D9FF',
    accentTertiary: '#8B9FDE',

    // State Colors
    stateSuccess: '#00C9A7',
    stateInfo: '#00D9FF',
    stateWarning: '#FFB800',
    stateError: '#FF3B3B',

    // UI Elements
    border: '#2D3748',
    borderFocus: '#00FF41',
    borderError: '#FF3B3B',
    divider: '#1F2430',

    // Links
    linkDefault: '#00D9FF',
    linkHover: '#00FF41',

    // Syntax Highlighting
    syntaxBg: '#0D1117',
    syntaxKeyword: '#FF79C6',  // Pink
    syntaxString: '#00FF41',   // Green
    syntaxFunction: '#00D9FF', // Cyan
    syntaxComment: '#6272A4',  // Blue-gray
    syntaxVariable: '#FFB86C', // Orange
  },

  typography: {
    fontFamily: {
      primary: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      secondary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    fontSize: {
      xs: '0.625rem',   // 10px
      sm: '0.75rem',    // 12px
      md: '0.875rem',   // 14px
      lg: '1rem',       // 16px
      xl: '1.125rem',   // 18px
      '2xl': '1.5rem',  // 24px
      '3xl': '2rem',    // 32px
      h1: '2rem',       // 32px
      h2: '1.5rem',     // 24px
      h3: '1.125rem',   // 18px
      h4: '1rem',       // 16px
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  spacing: (factor: number) => `${0.25 * factor}rem`, // 4px base unit

  borderRadius: {
    none: '0px',
    sm: '2px',
    md: '4px',
    lg: '8px',
  },

  shadows: {
    sm: '0 2px 4px rgba(0, 255, 65, 0.05)',
    md: '0 4px 8px rgba(0, 255, 65, 0.1)',
    lg: '0 8px 16px rgba(0, 255, 65, 0.15)',
    glow: '0 0 20px rgba(0, 255, 65, 0.3)',
  },

  animations: {
    glitch: 'glitch 0.3s ease-in-out',
    fadeIn: 'fadeIn 0.2s ease-in',
    slideIn: 'slideIn 0.3s ease-out',
  },
};
