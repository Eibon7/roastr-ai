import React, { useState, useEffect, useLayoutEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

const ThemeToggle = () => {
  const [theme, setTheme] = useState(() => {
    // Check localStorage first, then default to system
    const savedTheme = localStorage.getItem('theme');
    return savedTheme || 'system';
  });

  // Apply theme immediately on mount (before useEffect)
  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    
    // Remove existing theme classes
    html.classList.remove('light', 'dark');
    body.classList.remove('light', 'dark');
    
    const currentTheme = localStorage.getItem('theme') || 'system';
    
    if (currentTheme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const finalTheme = isDark ? 'dark' : 'light';
      html.setAttribute('data-theme', finalTheme);
      html.classList.add(finalTheme);
      body.classList.add(finalTheme);
    } else {
      html.setAttribute('data-theme', currentTheme);
      html.classList.add(currentTheme);
      body.classList.add(currentTheme);
    }
    
    html.style.colorScheme = currentTheme === 'dark' || 
      (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark' : 'light';
  }, []);

  useEffect(() => {
    const applyTheme = (currentTheme) => {
      const html = document.documentElement;
      const body = document.body;
      
      // Remove existing theme classes
      html.classList.remove('light', 'dark');
      body.classList.remove('light', 'dark');
      
      if (currentTheme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const finalTheme = isDark ? 'dark' : 'light';
        html.setAttribute('data-theme', finalTheme);
        html.classList.add(finalTheme);
        body.classList.add(finalTheme);
      } else {
        html.setAttribute('data-theme', currentTheme);
        html.classList.add(currentTheme);
        body.classList.add(currentTheme);
      }
      
      // Force a style recalculation
      html.style.colorScheme = currentTheme === 'dark' || 
        (currentTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ? 'dark' : 'light';
    };

    // Apply theme immediately
    applyTheme(theme);
    
    // Save to localStorage
    localStorage.setItem('theme', theme);

    // Listen for system theme changes if theme is 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    if (theme === 'system') {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    }

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme]);

  const [isOpen, setIsOpen] = useState(false);

  const selectTheme = (selectedTheme) => {
    console.log('Changing theme to:', selectedTheme);
    setTheme(selectedTheme);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdown = document.getElementById('theme-dropdown');
      if (dropdown && !dropdown.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getIcon = (themeName = theme) => {
    switch (themeName) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'system':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Sun className="h-4 w-4" />;
    }
  };

  const getLabel = (themeName = theme) => {
    switch (themeName) {
      case 'light':
        return 'Claro';
      case 'dark':
        return 'Oscuro';
      case 'system':
        return 'Sistema';
      default:
        return 'Sistema';
    }
  };

  return (
    <div id="theme-dropdown" className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-lg border border-border hover:bg-accent transition-colors bg-card"
        title={`Current theme: ${getLabel()}. Click to change.`}
      >
        {getIcon()}
        <span className="text-sm font-medium text-foreground">{getLabel()}</span>
        <svg className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-36 bg-card border border-border rounded-lg shadow-lg z-50" style={{zIndex: 9999}}>
          {['system', 'light', 'dark'].map((themeName) => (
            <button
              key={themeName}
              onClick={() => selectTheme(themeName)}
              className={`w-full flex items-center space-x-2 px-3 py-2 text-left hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg ${
                theme === themeName ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
              }`}
            >
              {getIcon(themeName)}
              <span className="text-sm">{getLabel(themeName)}</span>
              {theme === themeName && (
                <div className="ml-auto">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;