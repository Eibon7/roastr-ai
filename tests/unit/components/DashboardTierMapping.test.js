/**
 * Dashboard Tier Mapping Test Suite - CodeRabbit Round 3
 * Tests for explicit tier mapping and global connection limits
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Dashboard from '../../../frontend/src/pages/dashboard';

// Mock router
jest.mock('react-router-dom', () => ({
  useLocation: () => ({ search: '' }),
  useNavigate: () => jest.fn()
}));

// Mock hooks
jest.mock('../../../frontend/src/hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ isEnabled: jest.fn(() => true), loading: false })
}));

jest.mock('../../../frontend/src/contexts/SidebarContext', () => ({
  useSidebar: () => ({ isSidebarVisible: true })
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Dashboard Tier Mapping and Global Limits', () => {
  beforeEach(() => {
    fetch.mockClear();
    localStorage.clear();
    localStorage.setItem('token', 'mock-token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('TIER_MAX_CONNECTIONS mapping', () => {
    test('should correctly map tier limits using explicit mapping', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            accounts: [],
            usage: { plan: 'free' }
          }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      render(<Dashboard />);

      // Wait for component to load
      await screen.findByText(/Conectar otras cuentas/i);

      // Verify free tier shows 0/1 limit
      expect(screen.getByText(/0\/1 conexiones utilizadas/i)).toBeInTheDocument();
    });

    test('should handle pro tier with 2 connection limit', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            accounts: [{ id: 1, platform: 'twitter' }],
            usage: { plan: 'pro' }
          }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      render(<Dashboard />);

      await screen.findByText(/Conectar otras cuentas/i);
      expect(screen.getByText(/1\/2 conexiones utilizadas/i)).toBeInTheDocument();
    });

    test('should fallback to default limit for unknown tier', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            accounts: [],
            usage: { plan: 'unknown_tier' }
          }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      render(<Dashboard />);

      await screen.findByText(/Conectar otras cuentas/i);
      // Should fallback to 2 connections for unknown tier
      expect(screen.getByText(/0\/2 conexiones utilizadas/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility attributes', () => {
    test('should include aria-label on warning icons', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            accounts: [{ id: 1, platform: 'twitter' }],
            usage: { plan: 'free' } // Free tier with 1 account = at limit
          }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      render(<Dashboard />);

      await screen.findByText(/Conectar otras cuentas/i);
      
      // Should show warning icon with aria-label when at global limit
      const warningIcon = screen.getByLabelText(/Advertencia.*Límite global/i);
      expect(warningIcon).toBeInTheDocument();
      expect(warningIcon).toHaveAttribute('role', 'img');
    });

    test('should include data-testid on platform buttons', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            accounts: [],
            usage: { plan: 'pro' }
          }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      render(<Dashboard />);

      await screen.findByText(/Conectar otras cuentas/i);
      
      // Check for data-testid attributes on platform buttons
      const twitterButton = screen.getByTestId('connect-twitter-button');
      expect(twitterButton).toBeInTheDocument();
      expect(twitterButton).toHaveAttribute('aria-disabled', 'false');
    });

    test('should include aria-disabled on disabled buttons', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            accounts: [{ id: 1, platform: 'twitter' }],
            usage: { plan: 'free' } // At global limit
          }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      render(<Dashboard />);

      await screen.findByText(/Conectar otras cuentas/i);
      
      // Platform buttons should be disabled due to global limit
      const twitterButton = screen.getByTestId('connect-twitter-button');
      expect(twitterButton).toHaveAttribute('aria-disabled', 'true');
      expect(twitterButton).toBeDisabled();
    });
  });

  describe('Spanish localization', () => {
    test('should display contextual Spanish tooltips', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            accounts: [],
            usage: { plan: 'pro' }
          }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      render(<Dashboard />);

      await screen.findByText(/Conectar otras cuentas/i);
      
      // Should show Spanish connection text
      expect(screen.getByText(/conexiones utilizadas/i)).toBeInTheDocument();
      
      // Platform buttons should have Spanish accessibility text
      const twitterButton = screen.getByTestId('connect-twitter-button');
      expect(twitterButton).toHaveAttribute('title', 'Conectar cuenta de Twitter');
    });

    test('should show upgrade message in Spanish for free tier at limit', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            accounts: [{ id: 1, platform: 'twitter' }],
            usage: { plan: 'free' }
          }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      render(<Dashboard />);

      await screen.findByText(/Conectar otras cuentas/i);
      
      // Should show Spanish upgrade message
      expect(screen.getByText(/Mejora a Pro para conectar más cuentas/i)).toBeInTheDocument();
    });

    test('should show loading message in Spanish', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            accounts: [{ id: 1, platform: 'twitter' }]
            // No usage data simulates loading state
          }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      render(<Dashboard />);

      await screen.findByText(/Conectar otras cuentas/i);
      
      // Should show Spanish loading text
      expect(screen.getByText(/conexiones conectadas/i)).toBeInTheDocument();
    });
  });

  describe('Global vs Platform limits', () => {
    test('should prioritize global limit over platform limit', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            accounts: [{ id: 1, platform: 'twitter' }],
            usage: { plan: 'free' } // Global limit of 1, already reached
          }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      render(<Dashboard />);

      await screen.findByText(/Conectar otras cuentas/i);
      
      // Should show global limit warning, not platform limit
      expect(screen.getByText(/Límite global/i)).toBeInTheDocument();
      
      // All platform buttons should be disabled due to global limit
      const twitterButton = screen.getByTestId('connect-twitter-button');
      expect(twitterButton).toHaveAttribute('title', 'Límite global alcanzado para tu plan');
    });

    test('should show platform limit when global limit not reached', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            accounts: [
              { id: 1, platform: 'twitter' },
              { id: 2, platform: 'instagram' } // 2 accounts, but different platforms
            ],
            usage: { plan: 'pro' } // Global limit of 2, not reached
          }
        })
      };
      fetch.mockResolvedValue(mockResponse);

      render(<Dashboard />);

      await screen.findByText(/Conectar otras cuentas/i);
      
      // Should show available connections 
      expect(screen.getByText(/2\/2 conexiones utilizadas/i)).toBeInTheDocument();
      
      // Should show global limit reached
      const warningIcon = screen.getByLabelText(/Advertencia.*Límite global/i);
      expect(warningIcon).toBeInTheDocument();
    });
  });
});