/**
 * IntegrationStatusCard Component Tests
 * Tests the integration status display and management functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntegrationStatusCard from '../components/widgets/IntegrationStatusCard';

// Mock toast hook
const mockToast = jest.fn();
jest.mock('../../hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock action handlers
const mockOnConnect = jest.fn();
const mockOnDisconnect = jest.fn();
const mockOnRefresh = jest.fn();
const mockOnConfigure = jest.fn();

describe('IntegrationStatusCard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockDisconnectedConnection = {
    platform: 'twitter',
    connected: false,
    status: 'disconnected',
    connectedAt: null,
    lastRefreshed: null,
    expires_at: null,
    user_info: null
  };

  const mockConnectedConnection = {
    platform: 'twitter',
    connected: true,
    status: 'connected',
    connectedAt: Date.now() - 3600000, // 1 hour ago
    lastRefreshed: Date.now() - 1800000, // 30 minutes ago
    expires_at: Date.now() + 3600000, // 1 hour from now
    user_info: {
      id: 'mock_twitter_user_123',
      username: 'testuser',
      name: 'Test User',
      profile_image_url: 'https://example.com/avatar.jpg',
      public_metrics: {
        followers_count: 1234,
        following_count: 567
      }
    }
  };

  const mockExpiredConnection = {
    ...mockConnectedConnection,
    status: 'expired',
    expires_at: Date.now() - 3600000 // 1 hour ago
  };

  describe('Compact Mode', () => {
    it('should render compact disconnected state', () => {
      render(
        <IntegrationStatusCard
          connection={mockDisconnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
          compact={true}
        />
      );

      expect(screen.getByText('Twitter/X')).toBeInTheDocument();
      expect(screen.getByText('Not Connected')).toBeInTheDocument();
      expect(screen.getByText('𝕏')).toBeInTheDocument();
    });

    it('should render compact connected state with user info', () => {
      render(
        <IntegrationStatusCard
          connection={mockConnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
          compact={true}
        />
      );

      expect(screen.getByText('Twitter/X')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('should show settings dropdown for connected platforms in compact mode', async () => {
      const user = userEvent.setup();

      render(
        <IntegrationStatusCard
          connection={mockConnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
          onConfigure={mockOnConfigure}
          compact={true}
        />
      );

      const settingsButton = screen.getByRole('button');
      await user.click(settingsButton);

      expect(screen.getByText('Configure')).toBeInTheDocument();
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    it('should show refresh option for expired tokens in compact mode', async () => {
      const user = userEvent.setup();

      render(
        <IntegrationStatusCard
          connection={mockExpiredConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
          compact={true}
        />
      );

      const settingsButton = screen.getByRole('button');
      await user.click(settingsButton);

      expect(screen.getByText('Refresh Tokens')).toBeInTheDocument();
    });
  });

  describe('Full Card Mode', () => {
    it('should render full card for disconnected platform', () => {
      render(
        <IntegrationStatusCard
          connection={mockDisconnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('Twitter/X')).toBeInTheDocument();
      expect(screen.getByText('Not Connected')).toBeInTheDocument();
      expect(screen.getByText('Account not connected')).toBeInTheDocument();
      expect(screen.getByText('Connect Account')).toBeInTheDocument();
    });

    it('should render full card for connected platform with details', () => {
      render(
        <IntegrationStatusCard
          connection={mockConnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('Twitter/X')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('@testuser')).toBeInTheDocument();

      // Check connection stats
      expect(screen.getByText('Connected')).toBeInTheDocument();
      expect(screen.getByText('Last Active')).toBeInTheDocument();
    });

    it('should show avatar for connected users', () => {
      render(
        <IntegrationStatusCard
          connection={mockConnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      const avatar = screen.getByRole('img');
      expect(avatar).toHaveAttribute('src', mockConnectedConnection.user_info.profile_image_url);
      expect(avatar).toHaveAttribute('alt', mockConnectedConnection.user_info.name);
    });

    it('should show avatar fallback when no image', () => {
      const connectionWithoutImage = {
        ...mockConnectedConnection,
        user_info: {
          ...mockConnectedConnection.user_info,
          profile_image_url: null
        }
      };

      render(
        <IntegrationStatusCard
          connection={connectionWithoutImage}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnected}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('T')).toBeInTheDocument(); // First letter fallback
    });

    it('should show token expiry warning', () => {
      const soonToExpireConnection = {
        ...mockConnectedConnection,
        expires_at: Date.now() + 30 * 60 * 1000 // 30 minutes from now
      };

      render(
        <IntegrationStatusCard
          connection={soonToExpireConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText(/Token expires/)).toBeInTheDocument();
    });
  });

  describe('Status States', () => {
    it('should render expired status correctly', () => {
      render(
        <IntegrationStatusCard
          connection={mockExpiredConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('Token Expired')).toBeInTheDocument();
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });

    it('should render error status', () => {
      const errorConnection = {
        ...mockConnectedConnection,
        status: 'error'
      };

      render(
        <IntegrationStatusCard
          connection={errorConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('should show active status for connected platforms', () => {
      render(
        <IntegrationStatusCard
          connection={mockConnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('Action Handlers', () => {
    it('should call onConnect when connect button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <IntegrationStatusCard
          connection={mockDisconnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      const connectButton = screen.getByText('Connect Account');
      await user.click(connectButton);

      expect(mockOnConnect).toHaveBeenCalledWith('twitter');
    });

    it('should call onRefresh when refresh button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <IntegrationStatusCard
          connection={mockExpiredConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      const refreshButton = screen.getByText('Refresh');
      await user.click(refreshButton);

      expect(mockOnRefresh).toHaveBeenCalledWith('twitter');
    });

    it('should call onDisconnect from settings menu', async () => {
      const user = userEvent.setup();

      render(
        <IntegrationStatusCard
          connection={mockConnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      // Open settings menu
      const settingsButton = screen.getByRole('button');
      await user.click(settingsButton);

      // Click disconnect
      const disconnectButton = screen.getByText('Disconnect');
      await user.click(disconnectButton);

      expect(mockOnDisconnect).toHaveBeenCalledWith('twitter');
    });

    it('should call onConfigure when provided', async () => {
      const user = userEvent.setup();

      render(
        <IntegrationStatusCard
          connection={mockConnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
          onConfigure={mockOnConfigure}
        />
      );

      // Open settings menu
      const settingsButton = screen.getByRole('button');
      await user.click(settingsButton);

      // Click configure
      const configureButton = screen.getByText('Configure');
      await user.click(configureButton);

      expect(mockOnConfigure).toHaveBeenCalledWith('twitter');
    });
  });

  describe('Loading States', () => {
    it('should show loading state during connect action', async () => {
      const user = userEvent.setup();

      // Mock slow connect function
      const slowConnect = jest.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));

      render(
        <IntegrationStatusCard
          connection={mockDisconnectedConnection}
          onConnect={slowConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      const connectButton = screen.getByText('Connect Account');
      await user.click(connectButton);

      // Should show loading state briefly
      await waitFor(() => {
        expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument(); // Spinner
      });
    });

    it('should show loading state during refresh action', async () => {
      const user = userEvent.setup();

      // Mock slow refresh function
      const slowRefresh = jest.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));

      render(
        <IntegrationStatusCard
          connection={mockExpiredConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={slowRefresh}
        />
      );

      const refreshButton = screen.getByText('Refresh');
      await user.click(refreshButton);

      // Should disable button during loading
      expect(refreshButton).toBeDisabled();
    });

    it('should show loading state during disconnect action', async () => {
      const user = userEvent.setup();

      // Mock slow disconnect function
      const slowDisconnect = jest.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));

      render(
        <IntegrationStatusCard
          connection={mockConnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={slowDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      // Open settings menu
      const settingsButton = screen.getByRole('button');
      await user.click(settingsButton);

      // Click disconnect
      const disconnectButton = screen.getByText('Disconnect');
      await user.click(disconnectButton);

      // Should show loading spinner
      await waitFor(() => {
        expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle and display connect errors', async () => {
      const user = userEvent.setup();

      const errorConnect = jest.fn(() => Promise.reject(new Error('Connection failed')));

      render(
        <IntegrationStatusCard
          connection={mockDisconnectedConnection}
          onConnect={errorConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      const connectButton = screen.getByText('Connect Account');
      await user.click(connectButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Connect Failed',
          description: 'Connection failed',
          variant: 'destructive'
        });
      });
    });

    it('should handle refresh errors', async () => {
      const user = userEvent.setup();

      const errorRefresh = jest.fn(() => Promise.reject(new Error('Refresh failed')));

      render(
        <IntegrationStatusCard
          connection={mockExpiredConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={errorRefresh}
        />
      );

      const refreshButton = screen.getByText('Refresh');
      await user.click(refreshButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Refresh Failed',
          description: 'Refresh failed',
          variant: 'destructive'
        });
      });
    });

    it('should handle disconnect errors', async () => {
      const user = userEvent.setup();

      const errorDisconnect = jest.fn(() => Promise.reject(new Error('Disconnect failed')));

      render(
        <IntegrationStatusCard
          connection={mockConnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={errorDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      // Open settings menu
      const settingsButton = screen.getByRole('button');
      await user.click(settingsButton);

      // Click disconnect
      const disconnectButton = screen.getByText('Disconnect');
      await user.click(disconnectButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Disconnect Failed',
          description: 'Disconnect failed',
          variant: 'destructive'
        });
      });
    });
  });

  describe('Platform-Specific Rendering', () => {
    const platforms = [
      { platform: 'instagram', icon: '📷', name: 'Instagram' },
      { platform: 'youtube', icon: '📺', name: 'YouTube' },
      { platform: 'facebook', icon: '👥', name: 'Facebook' },
      { platform: 'bluesky', icon: '🦋', name: 'Bluesky' }
    ];

    platforms.forEach(({ platform, icon, name }) => {
      it(`should render ${platform} correctly`, () => {
        const connection = {
          ...mockDisconnectedConnection,
          platform
        };

        render(
          <IntegrationStatusCard
            connection={connection}
            onConnect={mockOnConnect}
            onDisconnect={mockOnDisconnect}
            onRefresh={mockOnRefresh}
          />
        );

        expect(screen.getByText(name)).toBeInTheDocument();
        expect(screen.getByText(icon)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for buttons', () => {
      render(
        <IntegrationStatusCard
          connection={mockDisconnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnected}
          onRefresh={mockOnRefresh}
        />
      );

      const connectButton = screen.getByRole('button', { name: /connect account/i });
      expect(connectButton).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <IntegrationStatusCard
          connection={mockConnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      // Tab to settings button
      await user.tab();
      const settingsButton = screen.getByRole('button');
      expect(settingsButton).toHaveFocus();

      // Enter should open menu
      await user.keyboard('{Enter}');
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    it('should have proper role attributes', () => {
      render(
        <IntegrationStatusCard
          connection={mockConnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      const avatar = screen.getByRole('img');
      expect(avatar).toHaveAttribute('alt', mockConnectedConnection.user_info.name);
    });
  });

  describe('Props Configuration', () => {
    it('should hide actions when showActions is false', () => {
      render(
        <IntegrationStatusCard
          connection={mockDisconnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
          showActions={false}
        />
      );

      expect(screen.queryByText('Connect Account')).not.toBeInTheDocument();
    });

    it('should not show configure option when onConfigure is not provided', async () => {
      const user = userEvent.setup();

      render(
        <IntegrationStatusCard
          connection={mockConnectedConnection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      const settingsButton = screen.getByRole('button');
      await user.click(settingsButton);

      expect(screen.queryByText('Configure')).not.toBeInTheDocument();
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });
  });

  describe('Time Formatting', () => {
    it('should format relative time correctly', () => {
      const connection = {
        ...mockConnectedConnection,
        connectedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        lastRefreshed: Date.now() - 30 * 60 * 1000 // 30 minutes ago
      };

      render(
        <IntegrationStatusCard
          connection={connection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText('30m ago')).toBeInTheDocument();
    });

    it('should handle null timestamps', () => {
      const connection = {
        ...mockConnectedConnection,
        lastRefreshed: null
      };

      render(
        <IntegrationStatusCard
          connection={connection}
          onConnect={mockOnConnect}
          onDisconnect={mockOnDisconnect}
          onRefresh={mockOnRefresh}
        />
      );

      // Should fall back to connectedAt time
      expect(screen.getByText('1h ago')).toBeInTheDocument();
    });
  });
});
