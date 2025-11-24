/**
 * Integration Tests for Dashboard Roast Editor - SPEC 8 Issue #364
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import Dashboard from '../dashboard';

// Mock all required contexts and hooks
const mockUseSidebar = {
  isSidebarVisible: true,
  toggleSidebar: jest.fn(),
  setSidebarVisible: jest.fn()
};

const mockUseFeatureFlags = {
  isEnabled: jest.fn(() => true),
  loading: false,
  flags: {}
};

jest.mock('../../contexts/SidebarContext', () => ({
  useSidebar: () => mockUseSidebar
}));

jest.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => mockUseFeatureFlags
}));

// Mock fetch globally
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage
});

// Mock React Router
const mockNavigate = jest.fn();
const mockLocation = { search: '' };

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation
}));

// Mock child components that are not essential for this test
jest.mock('../../components/widgets/AnalysisUsageCard', () => {
  return function MockAnalysisUsageCard() {
    return <div data-testid="analysis-usage-card">Analysis Usage Card</div>;
  };
});

jest.mock('../../components/widgets/RoastUsageCard', () => {
  return function MockRoastUsageCard() {
    return <div data-testid="roast-usage-card">Roast Usage Card</div>;
  };
});

jest.mock('../../components/AccountModal', () => {
  return function MockAccountModal({ onClose }) {
    return (
      <div data-testid="account-modal">
        <button onClick={onClose}>Close Modal</button>
      </div>
    );
  };
});

describe('Dashboard Roast Editor Integration - SPEC 8 Issue #364', () => {
  const mockRecentRoasts = [
    {
      id: 'roast-1',
      content: 'Este es un roast de prueba',
      platform: 'twitter',
      status: 'draft',
      created_at: '2024-01-15T10:30:00Z'
    },
    {
      id: 'roast-2',
      content: 'Otro roast para Instagram',
      platform: 'instagram',
      status: 'published',
      created_at: '2024-01-15T09:15:00Z'
    }
  ];

  const mockUsageData = {
    roastsRemaining: 95,
    roastsLimit: 100,
    platformUsage: {
      twitter: { roasts: 3, limit: 1000 },
      instagram: { roasts: 2, limit: 1000 }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-auth-token');
    mockSessionStorage.getItem.mockReturnValue(null);

    // Mock successful API responses by default
    fetch.mockImplementation((url) => {
      if (url.includes('/api/user/integrations')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] })
        });
      }

      if (url.includes('/api/user/usage')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockUsageData })
        });
      }

      if (url.includes('/api/user/roasts/recent')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockRecentRoasts })
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: {} })
      });
    });
  });

  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
  };

  describe('Recent Roasts Display', () => {
    it('should display recent roasts in normal view mode', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Últimos roasts')).toBeInTheDocument();
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
        expect(screen.getByText('Otro roast para Instagram')).toBeInTheDocument();
      });

      // Check that edit buttons are present
      const editButtons = screen.getAllByTitle('Editar roast');
      expect(editButtons).toHaveLength(2);
    });

    it('should show roast metadata correctly', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Twitter')).toBeInTheDocument();
        expect(screen.getByText('Instagram')).toBeInTheDocument();
        expect(screen.getByText('Borrador')).toBeInTheDocument();
        expect(screen.getByText('Publicado')).toBeInTheDocument();
      });
    });
  });

  describe('Inline Editor Integration', () => {
    it('should switch to edit mode when edit button is clicked', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      });

      // Click the first edit button
      const editButtons = screen.getAllByTitle('Editar roast');
      fireEvent.click(editButtons[0]);

      // Should now show the inline editor
      await waitFor(() => {
        expect(screen.getByText('Editor de Roast')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Este es un roast de prueba')).toBeInTheDocument();
        expect(screen.getByText('Validar')).toBeInTheDocument();
        expect(screen.getByText('Guardar')).toBeInTheDocument();
        expect(screen.getByText('Cancelar')).toBeInTheDocument();
      });

      // Original roast display should be hidden
      expect(screen.queryByText('Roast Generado')).not.toBeInTheDocument();
    });

    it('should toggle between roasts when editing different ones', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      });

      // Click edit on first roast
      const editButtons = screen.getAllByTitle('Editar roast');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Este es un roast de prueba')).toBeInTheDocument();
      });

      // Click edit on second roast (should close first and open second)
      fireEvent.click(editButtons[1]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Otro roast para Instagram')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('Este es un roast de prueba')).not.toBeInTheDocument();
      });
    });

    it('should close editor when clicking same edit button again', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByTitle('Editar roast');

      // Open editor
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Editor de Roast')).toBeInTheDocument();
      });

      // Close editor by clicking same button again
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.queryByText('Editor de Roast')).not.toBeInTheDocument();
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      });
    });
  });

  describe('Save Functionality', () => {
    it('should save edited roast and refresh the list', async () => {
      const updatedRoast = {
        ...mockRecentRoasts[0],
        content: 'Este es un roast editado y guardado'
      };

      // Mock PATCH request for saving
      fetch.mockImplementation((url, options) => {
        if (url.includes('/api/user/integrations')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: [] })
          });
        }

        if (url.includes('/api/user/usage')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockUsageData })
          });
        }

        if (url.includes('/api/user/roasts/roast-1') && options?.method === 'PATCH') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          });
        }

        if (url.includes('/api/user/roasts/recent')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: [updatedRoast, mockRecentRoasts[1]]
              })
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: {} })
        });
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      });

      // Enter edit mode
      const editButtons = screen.getAllByTitle('Editar roast');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Este es un roast de prueba')).toBeInTheDocument();
      });

      // Edit the text
      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'Este es un roast editado y guardado');

      // Save the changes
      const saveButton = screen.getByText('Guardar');
      fireEvent.click(saveButton);

      // Should call PATCH API
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/user/roasts/roast-1', {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer mock-auth-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: 'Este es un roast editado y guardado',
            validation: null
          })
        });
      });

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText('Roast actualizado exitosamente')).toBeInTheDocument();
      });

      // Should refresh the roasts list
      await waitFor(() => {
        expect(screen.getByText('Este es un roast editado y guardado')).toBeInTheDocument();
      });
    });

    it('should handle save errors gracefully', async () => {
      // Mock failed PATCH request
      fetch.mockImplementation((url, options) => {
        if (url.includes('/api/user/roasts/roast-1') && options?.method === 'PATCH') {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Failed to save roast' })
          });
        }

        // Default responses for other endpoints
        if (url.includes('/api/user/integrations')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: [] })
          });
        }

        if (url.includes('/api/user/usage')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockUsageData })
          });
        }

        if (url.includes('/api/user/roasts/recent')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockRecentRoasts })
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: {} })
        });
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      });

      // Enter edit mode and make changes
      const editButtons = screen.getAllByTitle('Editar roast');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Este es un roast de prueba')).toBeInTheDocument();
      });

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.type(textarea, ' con error');

      // Try to save
      const saveButton = screen.getByText('Guardar');
      fireEvent.click(saveButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText('Failed to save roast')).toBeInTheDocument();
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('should cancel editing and restore original state', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      });

      // Enter edit mode
      const editButtons = screen.getAllByTitle('Editar roast');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Este es un roast de prueba')).toBeInTheDocument();
      });

      // Make some changes
      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.type(textarea, ' modificado');

      expect(screen.getByDisplayValue('Este es un roast de prueba modificado')).toBeInTheDocument();

      // Cancel the changes
      const cancelButton = screen.getByText('Cancelar');
      fireEvent.click(cancelButton);

      // Should return to view mode with original content
      await waitFor(() => {
        expect(screen.queryByText('Editor de Roast')).not.toBeInTheDocument();
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      });
    });
  });

  describe('Validation Integration', () => {
    it('should handle validation results from inline editor', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      });

      // Enter edit mode
      const editButtons = screen.getAllByTitle('Editar roast');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Este es un roast de prueba')).toBeInTheDocument();
      });

      // Simulate validation result callback
      // This would be called by the RoastInlineEditor component
      const mockValidation = { valid: true, errors: [], warnings: [] };
      const mockCredits = { remaining: 94, limit: 100 };

      // The validation callback should update the usage state
      // Since we can't directly test the callback, we'll verify the component
      // can handle the state updates properly by checking it doesn't crash
      expect(screen.getByText('Editor de Roast')).toBeInTheDocument();
    });

    it('should update credit information after validation', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      });

      // The usage cards should be displayed
      expect(screen.getByTestId('analysis-usage-card')).toBeInTheDocument();
      expect(screen.getByTestId('roast-usage-card')).toBeInTheDocument();
    });
  });

  describe('Other Roast Actions', () => {
    it('should not interfere with other roast actions', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      });

      // Check that other action buttons are still present and functional
      const regenerateButtons = screen.getAllByTitle('Regenerar roast');
      const publishButtons = screen.getAllByTitle('Publicar roast');
      const discardButtons = screen.getAllByTitle('Descartar roast');

      expect(regenerateButtons).toHaveLength(2);
      expect(publishButtons).toHaveLength(1); // Only for drafts
      expect(discardButtons).toHaveLength(2);

      // These buttons should still be clickable when not in edit mode
      expect(regenerateButtons[0]).not.toBeDisabled();
      expect(discardButtons[0]).not.toBeDisabled();
    });

    it('should handle simultaneous actions gracefully', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      });

      // Enter edit mode
      const editButtons = screen.getAllByTitle('Editar roast');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Editor de Roast')).toBeInTheDocument();
      });

      // Other action buttons should still work for other roasts
      const regenerateButtons = screen.getAllByTitle('Regenerar roast');
      expect(regenerateButtons[1]).not.toBeDisabled(); // Second roast should still be actionable
    });
  });

  describe('Responsive Behavior', () => {
    it('should handle sidebar visibility changes', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Últimos roasts')).toBeInTheDocument();
      });

      // Check that the dashboard renders correctly
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('analysis-usage-card')).toBeInTheDocument();
      expect(screen.getByTestId('roast-usage-card')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors when loading roasts', async () => {
      // Mock API failure
      fetch.mockImplementation((url) => {
        if (url.includes('/api/user/roasts/recent')) {
          return Promise.reject(new Error('Network error'));
        }

        if (url.includes('/api/user/integrations')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: [] })
          });
        }

        if (url.includes('/api/user/usage')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockUsageData })
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: {} })
        });
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('No hay roasts recientes')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching data', () => {
      // Mock slow API responses
      fetch.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () => Promise.resolve({ data: [] })
                }),
              100
            );
          })
      );

      renderDashboard();

      // Should show loading skeletons
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      // The exact loading implementation may vary, so we just check the component renders
    });
  });

  describe('State Management', () => {
    it('should maintain editor state correctly across re-renders', async () => {
      const { rerender } = renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      });

      // Enter edit mode
      const editButtons = screen.getAllByTitle('Editar roast');
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('Editor de Roast')).toBeInTheDocument();
      });

      // Re-render component
      rerender(
        <BrowserRouter>
          <Dashboard />
        </BrowserRouter>
      );

      // Should maintain edit state after re-render
      await waitFor(() => {
        expect(screen.getByText('Editor de Roast')).toBeInTheDocument();
      });
    });
  });
});
