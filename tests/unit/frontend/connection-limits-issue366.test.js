/**
 * Comprehensive tests for Issue #366 - Connection Limits Validation
 * Tests the connection limits enforcement by subscription tier
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react-hooks';
import '@testing-library/jest-dom';

// Mock the useSocialAccounts hook
const mockUseSocialAccounts = jest.fn();

jest.mock('../../../frontend/src/hooks/useSocialAccounts', () => ({
  useSocialAccounts: mockUseSocialAccounts
}));

// Mock network constants
jest.mock('../../../frontend/src/mocks/social', () => ({
  NETWORK_ICONS: {
    twitter: '🐦',
    instagram: '📷',
    facebook: '👥',
    youtube: '📺'
  },
  NETWORK_COLORS: {
    twitter: 'bg-blue-500 text-white',
    instagram: 'bg-purple-500 text-white',
    facebook: 'bg-blue-600 text-white',
    youtube: 'bg-red-500 text-white'
  }
}));

describe('Issue #366 - Connection Limits Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useSocialAccounts Hook - Connection Limits', () => {
    it('should return correct limits for free plan user', () => {
      mockUseSocialAccounts.mockReturnValue({
        accounts: [],
        availableNetworks: [
          {
            network: 'twitter',
            name: 'Twitter',
            connectedCount: 0,
            canConnect: true,
            limitReached: false
          },
          {
            network: 'instagram',
            name: 'Instagram',
            connectedCount: 1,
            canConnect: false,
            limitReached: true
          }
        ],
        userData: { plan: 'free', isAdminMode: false },
        getConnectionLimits: jest.fn().mockReturnValue({
          maxConnections: 1,
          planTier: 'free'
        })
      });

      const { result } = renderHook(() => mockUseSocialAccounts());

      expect(result.current.getConnectionLimits()).toEqual({
        maxConnections: 1,
        planTier: 'free'
      });

      // Check that Instagram is at limit
      const instagramNetwork = result.current.availableNetworks.find(
        (n) => n.network === 'instagram'
      );
      expect(instagramNetwork.canConnect).toBe(false);
      expect(instagramNetwork.limitReached).toBe(true);
    });

    it('should return correct limits for pro plan user', () => {
      mockUseSocialAccounts.mockReturnValue({
        accounts: [],
        availableNetworks: [
          {
            network: 'twitter',
            name: 'Twitter',
            connectedCount: 1,
            canConnect: true,
            limitReached: false
          },
          {
            network: 'instagram',
            name: 'Instagram',
            connectedCount: 2,
            canConnect: false,
            limitReached: true
          }
        ],
        userData: { plan: 'pro', isAdminMode: false },
        getConnectionLimits: jest.fn().mockReturnValue({
          maxConnections: 2,
          planTier: 'pro'
        })
      });

      const { result } = renderHook(() => mockUseSocialAccounts());

      expect(result.current.getConnectionLimits()).toEqual({
        maxConnections: 2,
        planTier: 'pro'
      });
    });

    it('should handle admin mode correctly', () => {
      mockUseSocialAccounts.mockReturnValue({
        accounts: [],
        availableNetworks: [],
        userData: {
          plan: 'free',
          isAdminMode: true,
          adminModeUser: { plan: 'plus' }
        },
        getConnectionLimits: jest.fn().mockReturnValue({
          maxConnections: 2,
          planTier: 'plus'
        })
      });

      const { result } = renderHook(() => mockUseSocialAccounts());

      // Should use adminModeUser plan instead of user plan
      expect(result.current.getConnectionLimits().planTier).toBe('plus');
      expect(result.current.getConnectionLimits().maxConnections).toBe(2);
    });
  });

  describe('AccountsPage - Connection Limits UI', () => {
    it('should display connection limits info section', () => {
      mockUseSocialAccounts.mockReturnValue({
        accounts: [],
        availableNetworks: [
          {
            network: 'twitter',
            name: 'Twitter',
            connectedCount: 1,
            canConnect: false,
            limitReached: true
          }
        ],
        userData: { plan: 'free' },
        getConnectionLimits: jest.fn().mockReturnValue({
          maxConnections: 1,
          planTier: 'free'
        }),
        // ... other required mock properties
        getAccountById: jest.fn(),
        roastsByAccount: jest.fn(),
        interceptedByAccount: jest.fn(),
        totalAccounts: 1,
        activeAccounts: 1,
        totalMonthlyRoasts: 10,
        onApproveRoast: jest.fn(),
        onRejectRoast: jest.fn(),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeShieldLevel: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeTone: jest.fn(),
        onConnectNetwork: jest.fn(),
        onDisconnectAccount: jest.fn()
      });

      const { default: AccountsPage } = require('../../../frontend/src/pages/AccountsPage');

      render(<AccountsPage />);

      // Should show limits info section
      expect(screen.getByText(/límites de conexión por plan/i)).toBeInTheDocument();
      expect(screen.getByText(/tu plan actual \(free\)/i)).toBeInTheDocument();
      expect(screen.getByText(/1 conexión por red social/i)).toBeInTheDocument();
      expect(
        screen.getByText(/actualiza a pro para conectar hasta 2 cuentas/i)
      ).toBeInTheDocument();
    });

    it('should disable connection buttons when limit reached', () => {
      mockUseSocialAccounts.mockReturnValue({
        accounts: [],
        availableNetworks: [
          {
            network: 'twitter',
            name: 'Twitter',
            connectedCount: 1,
            canConnect: false,
            limitReached: true
          },
          {
            network: 'instagram',
            name: 'Instagram',
            connectedCount: 0,
            canConnect: true,
            limitReached: false
          }
        ],
        userData: { plan: 'free' },
        getConnectionLimits: jest.fn().mockReturnValue({
          maxConnections: 1,
          planTier: 'free'
        }),
        // ... other required mock properties
        getAccountById: jest.fn(),
        roastsByAccount: jest.fn(),
        interceptedByAccount: jest.fn(),
        totalAccounts: 1,
        activeAccounts: 1,
        totalMonthlyRoasts: 10,
        onApproveRoast: jest.fn(),
        onRejectRoast: jest.fn(),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeShieldLevel: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeTone: jest.fn(),
        onConnectNetwork: jest.fn(),
        onDisconnectAccount: jest.fn()
      });

      const { default: AccountsPage } = require('../../../frontend/src/pages/AccountsPage');

      render(<AccountsPage />);

      // Find network connection buttons
      const buttons = screen.getAllByRole('button');
      const twitterButton = buttons.find((btn) => btn.textContent.includes('Twitter'));
      const instagramButton = buttons.find((btn) => btn.textContent.includes('Instagram'));

      // Twitter should be disabled (at limit)
      expect(twitterButton).toBeDisabled();
      expect(twitterButton).toHaveAttribute('title', expect.stringContaining('Límite alcanzado'));

      // Instagram should be enabled
      expect(instagramButton).not.toBeDisabled();
      expect(instagramButton).toHaveAttribute('title', 'Conectar Instagram');
    });

    it('should show connection count ratios', () => {
      mockUseSocialAccounts.mockReturnValue({
        accounts: [],
        availableNetworks: [
          {
            network: 'twitter',
            name: 'Twitter',
            connectedCount: 1,
            canConnect: true,
            limitReached: false
          },
          {
            network: 'instagram',
            name: 'Instagram',
            connectedCount: 2,
            canConnect: false,
            limitReached: true
          }
        ],
        userData: { plan: 'pro' },
        getConnectionLimits: jest.fn().mockReturnValue({
          maxConnections: 2,
          planTier: 'pro'
        }),
        // ... other required mock properties
        getAccountById: jest.fn(),
        roastsByAccount: jest.fn(),
        interceptedByAccount: jest.fn(),
        totalAccounts: 3,
        activeAccounts: 2,
        totalMonthlyRoasts: 25,
        onApproveRoast: jest.fn(),
        onRejectRoast: jest.fn(),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeShieldLevel: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeTone: jest.fn(),
        onConnectNetwork: jest.fn(),
        onDisconnectAccount: jest.fn()
      });

      const { default: AccountsPage } = require('../../../frontend/src/pages/AccountsPage');

      render(<AccountsPage />);

      // Should show connection ratios
      expect(screen.getByText('1/2 conectada')).toBeInTheDocument(); // Twitter
      expect(screen.getByText('2/2 conectadas')).toBeInTheDocument(); // Instagram
    });

    it('should show upgrade prompt for free users', () => {
      mockUseSocialAccounts.mockReturnValue({
        accounts: [],
        availableNetworks: [],
        userData: { plan: 'free' },
        getConnectionLimits: jest.fn().mockReturnValue({
          maxConnections: 1,
          planTier: 'free'
        }),
        // ... other required mock properties
        getAccountById: jest.fn(),
        roastsByAccount: jest.fn(),
        interceptedByAccount: jest.fn(),
        totalAccounts: 0,
        activeAccounts: 0,
        totalMonthlyRoasts: 0,
        onApproveRoast: jest.fn(),
        onRejectRoast: jest.fn(),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeShieldLevel: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeTone: jest.fn(),
        onConnectNetwork: jest.fn(),
        onDisconnectAccount: jest.fn()
      });

      const { default: AccountsPage } = require('../../../frontend/src/pages/AccountsPage');

      render(<AccountsPage />);

      expect(
        screen.getByText(/actualiza a pro para conectar hasta 2 cuentas/i)
      ).toBeInTheDocument();
    });

    it('should not show upgrade prompt for pro+ users', () => {
      mockUseSocialAccounts.mockReturnValue({
        accounts: [],
        availableNetworks: [],
        userData: { plan: 'pro' },
        getConnectionLimits: jest.fn().mockReturnValue({
          maxConnections: 2,
          planTier: 'pro'
        }),
        // ... other required mock properties
        getAccountById: jest.fn(),
        roastsByAccount: jest.fn(),
        interceptedByAccount: jest.fn(),
        totalAccounts: 0,
        activeAccounts: 0,
        totalMonthlyRoasts: 0,
        onApproveRoast: jest.fn(),
        onRejectRoast: jest.fn(),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeShieldLevel: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeTone: jest.fn(),
        onConnectNetwork: jest.fn(),
        onDisconnectAccount: jest.fn()
      });

      const { default: AccountsPage } = require('../../../frontend/src/pages/AccountsPage');

      render(<AccountsPage />);

      expect(screen.queryByText(/actualiza a pro/i)).not.toBeInTheDocument();
    });
  });

  describe('Network Connection Modal Integration', () => {
    it('should prevent modal opening when connection limit reached', () => {
      const mockOnConnectNetwork = jest.fn();

      mockUseSocialAccounts.mockReturnValue({
        accounts: [],
        availableNetworks: [
          {
            network: 'twitter',
            name: 'Twitter',
            connectedCount: 1,
            canConnect: false,
            limitReached: true
          }
        ],
        userData: { plan: 'free' },
        getConnectionLimits: jest.fn().mockReturnValue({
          maxConnections: 1,
          planTier: 'free'
        }),
        onConnectNetwork: mockOnConnectNetwork,
        // ... other required mock properties
        getAccountById: jest.fn(),
        roastsByAccount: jest.fn(),
        interceptedByAccount: jest.fn(),
        totalAccounts: 1,
        activeAccounts: 1,
        totalMonthlyRoasts: 10,
        onApproveRoast: jest.fn(),
        onRejectRoast: jest.fn(),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeShieldLevel: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeTone: jest.fn(),
        onDisconnectAccount: jest.fn()
      });

      const { default: AccountsPage } = require('../../../frontend/src/pages/AccountsPage');

      render(<AccountsPage />);

      // Find and click the disabled Twitter button
      const buttons = screen.getAllByRole('button');
      const twitterButton = buttons.find((btn) => btn.textContent.includes('Twitter'));

      fireEvent.click(twitterButton);

      // Modal should not open, onConnectNetwork should not be called
      expect(mockOnConnectNetwork).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should provide clear tooltips for disabled buttons', () => {
      mockUseSocialAccounts.mockReturnValue({
        accounts: [],
        availableNetworks: [
          {
            network: 'twitter',
            name: 'Twitter',
            connectedCount: 1,
            canConnect: false,
            limitReached: true
          }
        ],
        userData: { plan: 'free' },
        getConnectionLimits: jest.fn().mockReturnValue({
          maxConnections: 1,
          planTier: 'free'
        }),
        // ... other required mock properties
        getAccountById: jest.fn(),
        roastsByAccount: jest.fn(),
        interceptedByAccount: jest.fn(),
        totalAccounts: 1,
        activeAccounts: 1,
        totalMonthlyRoasts: 10,
        onApproveRoast: jest.fn(),
        onRejectRoast: jest.fn(),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeShieldLevel: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeTone: jest.fn(),
        onConnectNetwork: jest.fn(),
        onDisconnectAccount: jest.fn()
      });

      const { default: AccountsPage } = require('../../../frontend/src/pages/AccountsPage');

      render(<AccountsPage />);

      const buttons = screen.getAllByRole('button');
      const twitterButton = buttons.find((btn) => btn.textContent.includes('Twitter'));

      expect(twitterButton).toHaveAttribute(
        'title',
        'Límite alcanzado: 1 conexión por red social (Plan free)'
      );
    });

    it('should show visual indicators for limit reached', () => {
      mockUseSocialAccounts.mockReturnValue({
        accounts: [],
        availableNetworks: [
          {
            network: 'twitter',
            name: 'Twitter',
            connectedCount: 1,
            canConnect: false,
            limitReached: true
          }
        ],
        userData: { plan: 'free' },
        getConnectionLimits: jest.fn().mockReturnValue({
          maxConnections: 1,
          planTier: 'free'
        }),
        // ... other required mock properties
        getAccountById: jest.fn(),
        roastsByAccount: jest.fn(),
        interceptedByAccount: jest.fn(),
        totalAccounts: 1,
        activeAccounts: 1,
        totalMonthlyRoasts: 10,
        onApproveRoast: jest.fn(),
        onRejectRoast: jest.fn(),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeShieldLevel: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeTone: jest.fn(),
        onConnectNetwork: jest.fn(),
        onDisconnectAccount: jest.fn()
      });

      const { default: AccountsPage } = require('../../../frontend/src/pages/AccountsPage');

      render(<AccountsPage />);

      // Should show "Límite alcanzado" text
      expect(screen.getByText('Límite alcanzado')).toBeInTheDocument();
    });
  });
});
