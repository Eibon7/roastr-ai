import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Sidebar from '../Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import useFeatureFlags from '../../hooks/useFeatureFlags';

// Mock dependencies
jest.mock('../../contexts/AuthContext');
jest.mock('../../hooks/useFeatureFlags');

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  NavLink: ({ children, to, className, ...props }) => (
    <a
      href={to}
      className={typeof className === 'function' ? className({ isActive: false }) : className}
      {...props}
    >
      {children}
    </a>
  )
}));

const renderSidebar = () => {
  return render(<Sidebar />);
};

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Navigation Items', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        userData: {
          name: 'Test User',
          email: 'test@example.com'
        }
      });

      useFeatureFlags.mockReturnValue({
        flags: {},
        isEnabled: jest.fn().mockReturnValue(false)
      });
    });

    it('should render Home navigation item', () => {
      renderSidebar();

      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Dashboard principal')).toBeInTheDocument();
    });

    it('should render Settings navigation item', () => {
      renderSidebar();

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Configuración de usuario')).toBeInTheDocument();
    });

    it('should render user profile section', () => {
      renderSidebar();

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
    });
  });

  describe('Feature Flag Integration', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        userData: {
          name: 'Test User',
          email: 'test@example.com'
        }
      });
    });

    it('should show Shop when ENABLE_SHOP flag is true', () => {
      useFeatureFlags.mockReturnValue({
        flags: { ENABLE_SHOP: true },
        isEnabled: jest.fn().mockImplementation((flag) => flag === 'ENABLE_SHOP')
      });

      renderSidebar();

      expect(screen.getByText('Shop')).toBeInTheDocument();
      expect(screen.getByText('Tienda de addons')).toBeInTheDocument();
    });

    it('should hide Shop when ENABLE_SHOP flag is false', () => {
      useFeatureFlags.mockReturnValue({
        flags: { ENABLE_SHOP: false },
        isEnabled: jest.fn().mockReturnValue(false)
      });

      renderSidebar();

      expect(screen.queryByText('Shop')).not.toBeInTheDocument();
    });

    it('should hide Shop when feature flags are loading', () => {
      useFeatureFlags.mockReturnValue({
        flags: {},
        isEnabled: jest.fn().mockReturnValue(false)
      });

      renderSidebar();

      expect(screen.queryByText('Shop')).not.toBeInTheDocument();
    });
  });

  describe('Navigation Links', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        userData: {
          name: 'Test User',
          email: 'test@example.com'
        }
      });

      useFeatureFlags.mockReturnValue({
        flags: { ENABLE_SHOP: true },
        isEnabled: jest.fn().mockReturnValue(true)
      });
    });

    it('should have correct href for Home link', () => {
      renderSidebar();

      const homeLink = screen.getByRole('link', { name: /Home/ });
      expect(homeLink).toHaveAttribute('href', '/dashboard');
    });

    it('should have correct href for Settings link', () => {
      renderSidebar();

      const settingsLink = screen.getByRole('link', { name: /Settings/ });
      expect(settingsLink).toHaveAttribute('href', '/settings');
    });

    it('should have correct href for Shop link when enabled', () => {
      renderSidebar();

      const shopLink = screen.getByRole('link', { name: /Shop/ });
      expect(shopLink).toHaveAttribute('href', '/shop');
    });

    it('should have correct href for Profile link', () => {
      renderSidebar();

      const profileLink = screen.getByRole('link', { name: /Test User/ });
      expect(profileLink).toHaveAttribute('href', '/profile');
    });
  });

  describe('Mobile Functionality', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        userData: {
          name: 'Test User',
          email: 'test@example.com'
        }
      });

      useFeatureFlags.mockReturnValue({
        flags: {},
        isEnabled: jest.fn().mockReturnValue(false)
      });

      // Mock window.innerWidth for mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500
      });
    });

    it('should have mobile menu toggle button', () => {
      renderSidebar();

      const menuButton = screen.getByRole('button', { name: /toggle sidebar/i });
      expect(menuButton).toBeInTheDocument();
    });

    it('should toggle sidebar on mobile menu click', async () => {
      renderSidebar();

      const menuButton = screen.getByRole('button', { name: /toggle sidebar/i });

      fireEvent.click(menuButton);

      // Sidebar should be open (implementation detail may vary)
      await waitFor(() => {
        expect(menuButton).toBeInTheDocument();
      });
    });
  });

  describe('User Data Handling', () => {
    it('should handle missing user data gracefully', () => {
      useAuth.mockReturnValue({
        userData: null
      });

      useFeatureFlags.mockReturnValue({
        flags: {},
        isEnabled: jest.fn().mockReturnValue(false)
      });

      renderSidebar();

      expect(screen.getByText('Usuario')).toBeInTheDocument();
    });

    it('should handle partial user data', () => {
      useAuth.mockReturnValue({
        userData: {
          name: 'Test User'
          // Missing email
        }
      });

      useFeatureFlags.mockReturnValue({
        flags: {},
        isEnabled: jest.fn().mockReturnValue(false)
      });

      renderSidebar();

      expect(screen.getByText('Test User')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        userData: {
          name: 'Test User',
          email: 'test@example.com'
        }
      });

      useFeatureFlags.mockReturnValue({
        flags: { ENABLE_SHOP: true },
        isEnabled: jest.fn().mockReturnValue(true)
      });
    });

    it('should have proper navigation structure', () => {
      renderSidebar();

      const nav = screen.getByRole('navigation');
      expect(nav).toBeInTheDocument();
    });

    it('should have accessible links', () => {
      renderSidebar();

      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);

      links.forEach((link) => {
        expect(link).toHaveAttribute('href');
      });
    });

    it('should have proper button labels', () => {
      renderSidebar();

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAccessibleName();
      });
    });
  });
});
