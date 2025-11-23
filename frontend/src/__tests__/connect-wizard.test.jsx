/**
 * Connect Wizard Component Tests
 * Tests the social media connection wizard functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Connect from '../pages/Connect';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Mock toast hook
const mockToast = jest.fn();
jest.mock('../hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Test wrapper with router
const TestWrapper = ({ children }) => <BrowserRouter>{children}</BrowserRouter>;

describe('Connect Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-access-token');

    // Default mock responses
    mockFetch.mockImplementation((url) => {
      if (url.includes('/api/integrations/connections')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                connections: [
                  {
                    platform: 'twitter',
                    connected: false,
                    status: 'disconnected',
                    connectedAt: null,
                    lastRefreshed: null,
                    expires_at: null,
                    user_info: null
                  },
                  {
                    platform: 'instagram',
                    connected: false,
                    status: 'disconnected',
                    connectedAt: null,
                    lastRefreshed: null,
                    expires_at: null,
                    user_info: null
                  }
                ],
                totalConnected: 0,
                mockMode: true
              }
            })
        });
      }

      if (url.includes('/api/integrations/platforms')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: {
                platforms: [
                  {
                    platform: 'twitter',
                    name: 'Twitter',
                    enabled: true,
                    mockMode: true,
                    requirements: {
                      permissions: ['Read tweets', 'Write tweets'],
                      notes: 'Twitter Developer account required',
                      estimatedTime: '5-10 minutes'
                    },
                    scopes: ['read', 'write']
                  },
                  {
                    platform: 'instagram',
                    name: 'Instagram',
                    enabled: true,
                    mockMode: true,
                    requirements: {
                      permissions: ['Access basic profile', 'Read media'],
                      notes: 'Personal accounts only',
                      estimatedTime: '2-3 minutes'
                    },
                    scopes: ['instagram_basic']
                  }
                ],
                mockMode: true,
                totalPlatforms: 2,
                enabledPlatforms: 2
              }
            })
        });
      }

      return Promise.reject(new Error('Unhandled fetch URL: ' + url));
    });
  });

  describe('Initial Rendering', () => {
    it('should render the connect page with header', async () => {
      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Connect Your Social Media')).toBeInTheDocument();
      });

      expect(
        screen.getByText(
          'Connect your social media accounts to start generating AI-powered style profiles'
        )
      ).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument(); // Loading spinner
    });

    it('should display mock mode alert when enabled', async () => {
      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            'Mock mode is enabled. All connections are simulated for testing purposes.'
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe('Connection Progress', () => {
    it('should display correct progress statistics', async () => {
      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Connection Progress')).toBeInTheDocument();
      });

      expect(screen.getByText('0 of 2 platforms connected')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should update progress when connections exist', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('/api/integrations/connections')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  connections: [
                    {
                      platform: 'twitter',
                      connected: true,
                      status: 'connected',
                      connectedAt: Date.now() - 3600000,
                      user_info: { name: 'Test User', username: 'testuser' }
                    },
                    {
                      platform: 'instagram',
                      connected: false,
                      status: 'disconnected'
                    }
                  ],
                  totalConnected: 1,
                  mockMode: true
                }
              })
          });
        }
        return mockFetch.mockImplementation.mock.calls[0][0](url);
      });

      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('1 of 2 platforms connected')).toBeInTheDocument();
      });

      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  describe('Platform Cards', () => {
    it('should render platform cards with correct information', async () => {
      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Twitter')).toBeInTheDocument();
      });

      expect(screen.getByText('Instagram')).toBeInTheDocument();
      expect(screen.getByText('5-10 minutes')).toBeInTheDocument();
      expect(screen.getByText('2-3 minutes')).toBeInTheDocument();
    });

    it('should display platform requirements', async () => {
      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Required Permissions:')).toBeInTheDocument();
      });

      expect(screen.getByText('Read tweets')).toBeInTheDocument();
      expect(screen.getByText('Write tweets')).toBeInTheDocument();
      expect(screen.getByText('Access basic profile')).toBeInTheDocument();
      expect(screen.getByText('Read media')).toBeInTheDocument();
    });

    it('should show connect buttons for disconnected platforms', async () => {
      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        const connectButtons = screen.getAllByText('Connect');
        expect(connectButtons).toHaveLength(2);
      });
    });

    it('should show disconnect button for connected platforms', async () => {
      mockFetch.mockImplementation((url) => {
        if (url.includes('/api/integrations/connections')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  connections: [
                    {
                      platform: 'twitter',
                      connected: true,
                      status: 'connected',
                      connectedAt: Date.now(),
                      user_info: { name: 'Test User', username: 'testuser' }
                    }
                  ],
                  totalConnected: 1,
                  mockMode: true
                }
              })
          });
        }
        return mockFetch.mockImplementation.mock.calls[0][0](url);
      });

      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Connected Account')).toBeInTheDocument();
      });

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });
  });

  describe('Connection Flow', () => {
    it('should handle connect button click', async () => {
      const user = userEvent.setup();

      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/twitter/connect') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  authUrl:
                    'https://mock-oauth.roastr.ai/twitter/authorize?client_id=mock_twitter_client&state=mockstate',
                  state: 'mockstate',
                  platform: 'twitter',
                  mock: true,
                  requirements: {
                    permissions: ['Read tweets', 'Write tweets'],
                    notes: 'Twitter Developer account required',
                    estimatedTime: '5-10 minutes'
                  }
                }
              })
          });
        }
        return mockFetch.mockImplementation.mock.calls[0][0](url);
      });

      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Twitter')).toBeInTheDocument();
      });

      const connectButton = screen.getAllByText('Connect')[0];
      await user.click(connectButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/integrations/twitter/connect',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: 'Bearer mock-access-token'
            })
          })
        );
      });
    });

    it('should show connecting state during connection', async () => {
      const user = userEvent.setup();

      // Mock slow response
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/twitter/connect') && options?.method === 'POST') {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    success: true,
                    data: {
                      authUrl: 'mock-url',
                      state: 'mockstate',
                      platform: 'twitter',
                      mock: true
                    }
                  })
              });
            }, 100);
          });
        }
        return mockFetch.mockImplementation.mock.calls[0][0](url);
      });

      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Twitter')).toBeInTheDocument();
      });

      const connectButton = screen.getAllByText('Connect')[0];
      await user.click(connectButton);

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });

    it('should handle connection errors', async () => {
      const user = userEvent.setup();

      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/twitter/connect') && options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            json: () =>
              Promise.resolve({
                success: false,
                error: 'Connection failed'
              })
          });
        }
        return mockFetch.mockImplementation.mock.calls[0][0](url);
      });

      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Twitter')).toBeInTheDocument();
      });

      const connectButton = screen.getAllByText('Connect')[0];
      await user.click(connectButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Connection Failed',
          description: 'Connection failed',
          variant: 'destructive'
        });
      });
    });

    it('should handle already connected platforms', async () => {
      const user = userEvent.setup();

      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/twitter/connect') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  status: 'already_connected',
                  message: 'Already connected to twitter'
                }
              })
          });
        }
        return mockFetch.mockImplementation.mock.calls[0][0](url);
      });

      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Twitter')).toBeInTheDocument();
      });

      const connectButton = screen.getAllByText('Connect')[0];
      await user.click(connectButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Already Connected',
          description: "You're already connected to twitter",
          variant: 'default'
        });
      });
    });
  });

  describe('Mock OAuth Wizard', () => {
    it('should open wizard dialog for mock OAuth', async () => {
      const user = userEvent.setup();

      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/twitter/connect') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  authUrl: 'https://mock-oauth.roastr.ai/twitter/authorize',
                  state: 'mockstate',
                  platform: 'twitter',
                  mock: true
                }
              })
          });
        }
        return mockFetch.mockImplementation.mock.calls[0][0](url);
      });

      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Twitter')).toBeInTheDocument();
      });

      const connectButton = screen.getAllByText('Connect')[0];
      await user.click(connectButton);

      await waitFor(() => {
        expect(screen.getByText('Connect to twitter')).toBeInTheDocument();
      });

      expect(screen.getByText('Authorize Access')).toBeInTheDocument();
      expect(
        screen.getByText('This is a simulated OAuth flow for testing purposes.')
      ).toBeInTheDocument();
    });

    it('should simulate OAuth flow progression', async () => {
      const user = userEvent.setup();

      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/twitter/connect') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  authUrl: 'https://mock-oauth.roastr.ai/twitter/authorize',
                  state: 'mockstate',
                  platform: 'twitter',
                  mock: true
                }
              })
          });
        }
        return mockFetch.mockImplementation.mock.calls[0][0](url);
      });

      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Twitter')).toBeInTheDocument();
      });

      // Start connection
      const connectButton = screen.getAllByText('Connect')[0];
      await user.click(connectButton);

      await waitFor(() => {
        expect(screen.getByText('Continue to Authorization')).toBeInTheDocument();
      });

      // Continue to authorization
      const continueButton = screen.getByText('Continue to Authorization');
      await user.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });

      // Should show success after timeout
      await waitFor(
        () => {
          expect(screen.getByText('Successfully Connected!')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('Disconnect Flow', () => {
    beforeEach(() => {
      mockFetch.mockImplementation((url, options) => {
        if (url.includes('/api/integrations/connections')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  connections: [
                    {
                      platform: 'twitter',
                      connected: true,
                      status: 'connected',
                      connectedAt: Date.now(),
                      user_info: { name: 'Test User', username: 'testuser' }
                    }
                  ],
                  totalConnected: 1,
                  mockMode: true
                }
              })
          });
        }

        if (url.includes('/twitter/disconnect') && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  message: 'Successfully disconnected from twitter',
                  platform: 'twitter',
                  disconnected: true
                }
              })
          });
        }

        return mockFetch.mockImplementation.mock.calls[0][0](url);
      });
    });

    it('should handle disconnect button click', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Disconnect')).toBeInTheDocument();
      });

      const disconnectButton = screen.getByText('Disconnect');
      await user.click(disconnectButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/integrations/twitter/disconnect',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: 'Bearer mock-access-token'
            })
          })
        );
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: 'Disconnected',
        description: 'Successfully disconnected from twitter',
        variant: 'default'
      });
    });
  });

  describe('Authentication', () => {
    it('should redirect to auth if no token', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      expect(mockNavigate).toHaveBeenCalledWith('/auth.html');
    });

    it('should handle authentication errors', async () => {
      mockFetch.mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () =>
            Promise.resolve({
              success: false,
              error: 'Unauthorized'
            })
        });
      });

      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to load connection data',
          variant: 'destructive'
        });
      });
    });
  });

  describe('Help Section', () => {
    it('should display help information', async () => {
      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Need Help?')).toBeInTheDocument();
      });

      expect(screen.getByText('Why Connect Social Media?')).toBeInTheDocument();
      expect(screen.getByText('Privacy & Security')).toBeInTheDocument();
      expect(
        screen.getByText('Connecting your accounts allows our AI to analyze your writing style')
      ).toBeInTheDocument();
      expect(
        screen.getByText('We only read your public posts to analyze writing patterns.')
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        const connectButtons = screen.getAllByRole('button', { name: /connect/i });
        expect(connectButtons.length).toBeGreaterThan(0);
      });
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <Connect />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Twitter')).toBeInTheDocument();
      });

      // Tab to first connect button
      await user.tab();
      const firstButton = screen.getAllByText('Connect')[0];
      expect(firstButton).toHaveFocus();

      // Enter should trigger click
      await user.keyboard('{Enter}');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/integrations/twitter/connect',
        expect.any(Object)
      );
    });
  });
});
