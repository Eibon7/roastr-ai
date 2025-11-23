/**
 * StyleProfile Component - Unit Tests
 *
 * Tests for AI style profile generation with persona integration
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import StyleProfile from '../../../frontend/src/pages/StyleProfile';
import { createMockFetch } from '../../../frontend/src/lib/mockMode';

jest.mock('../../../frontend/src/lib/mockMode');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

const mockProfileData = {
  available: true,
  profiles: [
    {
      lang: 'es',
      prompt: 'Roast in Spanish with sarcasm',
      examples: ['Example 1 in Spanish', 'Example 2 in Spanish'],
      metadata: {
        totalItems: 250,
        avgLength: 120,
        dominantTone: 'sarcastic'
      },
      sources: {
        twitter: 150,
        instagram: 100
      }
    },
    {
      lang: 'en',
      prompt: 'Roast in English with wit',
      examples: ['Example 1 in English', 'Example 2 in English'],
      metadata: {
        totalItems: 180,
        avgLength: 110,
        dominantTone: 'witty'
      },
      sources: {
        twitter: 100,
        instagram: 80
      }
    }
  ],
  createdAt: '2025-01-01T00:00:00Z',
  totalItems: 430,
  sources: {
    twitter: 250,
    instagram: 180
  }
};

describe('StyleProfile Component', () => {
  let mockFetchApi;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFetchApi = jest.fn((url, options) => {
      if (url === '/api/style-profile/status') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: { available: true, hasAccess: true } })
        });
      }
      if (url === '/api/style-profile' && !options) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: mockProfileData })
        });
      }
      if (url === '/api/style-profile/generate') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: { ...mockProfileData, message: 'Profile generated' }
          })
        });
      }
      if (url === '/api/style-profile' && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true })
        });
      }
      if (url === '/api/integrations/status') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: {
              integrations: [
                {
                  platform: 'twitter',
                  status: 'connected',
                  importedCount: 150,
                  displayName: 'Twitter'
                },
                {
                  platform: 'instagram',
                  status: 'connected',
                  importedCount: 100,
                  displayName: 'Instagram'
                }
              ]
            }
          })
        });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });

    createMockFetch.mockReturnValue(mockFetchApi);
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <StyleProfile />
      </BrowserRouter>
    );
  };

  describe('Rendering', () => {
    it('should render page header', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/AI Style Profile/i)).toBeInTheDocument();
      });
    });

    it('should display profile data when available', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Style Profile Ready/i)).toBeInTheDocument();
        expect(screen.getByText(/430 posts/i)).toBeInTheDocument();
      });
    });

    it('should show language tabs', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Spanish/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /English/i })).toBeInTheDocument();
      });
    });
  });

  describe('Profile Generation', () => {
    it('should show generation interface when no profile exists', async () => {
      mockFetchApi.mockImplementation((url) => {
        if (url === '/api/style-profile' && mockFetchApi.mock.calls.length === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { available: false } })
          });
        }
        return mockFetchApi(url);
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Generate Your Style Profile/i)).toBeInTheDocument();
      });
    });

    it('should generate profile when button clicked', async () => {
      mockFetchApi.mockImplementation((url, options) => {
        if (url === '/api/style-profile' && !options) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { available: false } })
          });
        }
        if (url === '/api/style-profile/generate') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: mockProfileData })
          });
        }
        if (url === '/api/integrations/status') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: {
                integrations: [
                  {
                    platform: 'twitter',
                    status: 'connected',
                    importedCount: 150,
                    displayName: 'Twitter'
                  }
                ]
              }
            })
          });
        }
        if (url === '/api/style-profile/status') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { available: true, hasAccess: true } })
          });
        }
      });

      renderComponent();

      await waitFor(() => {
        const generateButton = screen.getByRole('button', { name: /Generate Style Profile/i });
        fireEvent.click(generateButton);
      });

      await waitFor(() => {
        expect(mockFetchApi).toHaveBeenCalledWith(
          '/api/style-profile/generate',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('twitter')
          })
        );
      });
    });

    it('should show loading state during generation', async () => {
      mockFetchApi.mockImplementation((url, options) => {
        if (url === '/api/style-profile' && !options) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { available: false } })
          });
        }
        if (url === '/api/style-profile/generate') {
          return new Promise(() => {}); // Never resolves
        }
        if (url === '/api/integrations/status') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: {
                integrations: [
                  {
                    platform: 'twitter',
                    status: 'connected',
                    importedCount: 150,
                    displayName: 'Twitter'
                  }
                ]
              }
            })
          });
        }
        if (url === '/api/style-profile/status') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { available: true, hasAccess: true } })
          });
        }
      });

      renderComponent();

      await waitFor(() => {
        const generateButton = screen.getByRole('button', { name: /Generate Style Profile/i });
        fireEvent.click(generateButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Generating Profile.../i)).toBeInTheDocument();
      });
    });

    it('should require platform connection before generation', async () => {
      mockFetchApi.mockImplementation((url) => {
        if (
          url === '/api/style-profile' &&
          !mockFetchApi.mock.calls.some((call) => call[0] === '/api/style-profile' && call[1])
        ) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { available: false } })
          });
        }
        if (url === '/api/integrations/status') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: { integrations: [] }
            })
          });
        }
        if (url === '/api/style-profile/status') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { available: true, hasAccess: true } })
          });
        }
        return mockFetchApi(url);
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Connect Platforms First/i)).toBeInTheDocument();
      });
    });
  });

  describe('Language Selection', () => {
    it('should switch between language profiles', async () => {
      renderComponent();

      await waitFor(() => {
        const englishButton = screen.getByRole('button', { name: /English/i });
        fireEvent.click(englishButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Roast in English with wit/i)).toBeInTheDocument();
      });
    });

    it('should display prompt for selected language', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Roast in Spanish with sarcasm/i)).toBeInTheDocument();
      });
    });

    it('should show examples for selected language', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Example 1 in Spanish/i)).toBeInTheDocument();
        expect(screen.getByText(/Example 2 in Spanish/i)).toBeInTheDocument();
      });
    });
  });

  describe('Copy Prompt Feature', () => {
    it('should copy prompt to clipboard', async () => {
      const mockClipboard = {
        writeText: jest.fn(() => Promise.resolve())
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      renderComponent();

      await waitFor(() => {
        const copyButton = screen.getAllByRole('button', { name: /Copy/i })[0];
        fireEvent.click(copyButton);
      });

      await waitFor(() => {
        expect(mockClipboard.writeText).toHaveBeenCalledWith('Roast in Spanish with sarcasm');
      });
    });

    it('should show copied state after copy', async () => {
      const mockClipboard = {
        writeText: jest.fn(() => Promise.resolve())
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      renderComponent();

      await waitFor(() => {
        const copyButton = screen.getAllByRole('button', { name: /Copy/i })[0];
        fireEvent.click(copyButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Copied!/i)).toBeInTheDocument();
      });
    });
  });

  describe('Profile Deletion', () => {
    it('should show delete confirmation dialog', async () => {
      renderComponent();

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /Delete/i });
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Are you sure you want to delete your style profile\?/i)
        ).toBeInTheDocument();
      });
    });

    it('should delete profile when confirmed', async () => {
      renderComponent();

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /Delete/i });
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        const confirmButton = screen
          .getAllByRole('button', { name: /Delete/i })
          .find((btn) => btn.closest('[role="dialog"]'));
        if (confirmButton) fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(mockFetchApi).toHaveBeenCalledWith(
          '/api/style-profile',
          expect.objectContaining({ method: 'DELETE' })
        );
      });
    });
  });

  describe('Access Control', () => {
    it('should redirect to plans if no access', async () => {
      mockFetchApi.mockImplementation((url) => {
        if (url === '/api/style-profile/status') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { available: false, hasAccess: false } })
          });
        }
        return mockFetchApi(url);
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Creator\+ Required/i)).toBeInTheDocument();
      });
    });

    it('should show upgrade button when no access', async () => {
      mockFetchApi.mockImplementation((url) => {
        if (url === '/api/style-profile/status') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { available: false, hasAccess: false } })
          });
        }
        return mockFetchApi(url);
      });

      renderComponent();

      await waitFor(() => {
        const upgradeButton = screen.getByRole('button', { name: /Upgrade to Creator\+/i });
        expect(upgradeButton).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display error message on generation failure', async () => {
      mockFetchApi.mockImplementation((url, options) => {
        if (url === '/api/style-profile' && !options) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { available: false } })
          });
        }
        if (url === '/api/style-profile/generate') {
          return Promise.reject(new Error('Network error'));
        }
        if (url === '/api/integrations/status') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: {
                integrations: [
                  {
                    platform: 'twitter',
                    status: 'connected',
                    importedCount: 150,
                    displayName: 'Twitter'
                  }
                ]
              }
            })
          });
        }
        if (url === '/api/style-profile/status') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { available: true, hasAccess: true } })
          });
        }
      });

      renderComponent();

      await waitFor(() => {
        const generateButton = screen.getByRole('button', { name: /Generate Style Profile/i });
        fireEvent.click(generateButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Failed to generate style profile/i)).toBeInTheDocument();
      });
    });

    it('should allow retrying after error', async () => {
      mockFetchApi.mockImplementation((url, options) => {
        if (url === '/api/style-profile' && !options) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { available: false } })
          });
        }
        if (url === '/api/style-profile/generate') {
          return Promise.reject(new Error('Network error'));
        }
        if (url === '/api/integrations/status') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: {
                integrations: [
                  {
                    platform: 'twitter',
                    status: 'connected',
                    importedCount: 150,
                    displayName: 'Twitter'
                  }
                ]
              }
            })
          });
        }
        if (url === '/api/style-profile/status') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: { available: true, hasAccess: true } })
          });
        }
      });

      renderComponent();

      await waitFor(() => {
        const generateButton = screen.getByRole('button', { name: /Generate Style Profile/i });
        fireEvent.click(generateButton);
      });

      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /Retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });
  });

  describe('Profile Metadata', () => {
    it('should display creation date', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Jan 1, 2025/i)).toBeInTheDocument();
      });
    });

    it('should show items analyzed count', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/430 posts/i)).toBeInTheDocument();
      });
    });

    it('should display platform sources', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/twitter: 250/i)).toBeInTheDocument();
        expect(screen.getByText(/instagram: 180/i)).toBeInTheDocument();
      });
    });
  });
});
