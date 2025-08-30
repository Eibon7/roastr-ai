import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AjustesSettings from '../../../frontend/src/components/AjustesSettings';
import { apiClient } from '../../../frontend/src/lib/api';

// Mock dependencies
jest.mock('../../../frontend/src/lib/api');
jest.mock('../../../frontend/src/components/TransparencySettings', () => {
  return function MockTransparencySettings() {
    return <div data-testid="transparency-settings">Transparency Settings Component</div>;
  };
});

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve()),
  },
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('AjustesSettings Component', () => {
  const mockUser = {
    id: 'test-user-id',
    email: 'test@example.com',
    plan: 'pro'
  };

  const mockOnNotification = jest.fn();

  const mockApiResponses = {
    roastrPersona: {
      success: true,
      data: {
        loQueMeDefine: 'Soy desarrollador',
        loQueNoTolero: 'Comentarios ofensivos',
        loQueMeDaIgual: 'Bromas sobre mi edad',
        isVisible: false,
        isIntoleranceVisible: false,
        isToleranceVisible: false,
        hasContent: true,
        hasIntoleranceContent: true,
        hasToleranceContent: true
      }
    },
    theme: {
      success: true,
      data: {
        theme: 'system',
        options: [
          { value: 'light', label: 'Claro', description: 'Tema claro siempre activo' },
          { value: 'dark', label: 'Oscuro', description: 'Tema oscuro siempre activo' },
          { value: 'system', label: 'Sistema', description: 'Sigue la configuración del sistema', isDefault: true }
        ]
      }
    },
    transparency: {
      success: true,
      data: {
        transparency_mode: 'bio',
        bio_text: '🤖 Algunas respuestas pueden ser generadas por IA'
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    apiClient.get.mockImplementation((url) => {
      switch (url) {
        case '/user/roastr-persona':
          return Promise.resolve(mockApiResponses.roastrPersona);
        case '/user/settings/theme':
          return Promise.resolve(mockApiResponses.theme);
        case '/user/settings/transparency-mode':
          return Promise.resolve(mockApiResponses.transparency);
        default:
          return Promise.reject(new Error('Unknown endpoint'));
      }
    });

    apiClient.post.mockResolvedValue({ success: true });
    apiClient.patch.mockResolvedValue({ success: true });
  });

  it('should render loading state initially', () => {
    // Make API calls hang to test loading state
    apiClient.get.mockImplementation(() => new Promise(() => {}));

    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    expect(screen.getByText('Ajustes')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
  });

  it('should render all sections after loading', async () => {
    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Roastr Persona')).toBeInTheDocument();
      expect(screen.getByText('Transparencia')).toBeInTheDocument();
      expect(screen.getByText('Estilo de la interfaz')).toBeInTheDocument();
    });
  });

  it('should display Roastr Persona fields correctly', async () => {
    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Lo que me define')).toBeInTheDocument();
      expect(screen.getByText('Lo que no tolero')).toBeInTheDocument();
      expect(screen.getByText('Lo que me da igual')).toBeInTheDocument();
    });

    // Check that configured fields show "Configurado" badge
    expect(screen.getAllByText('Configurado')).toHaveLength(3);
  });

  it('should display theme options correctly', async () => {
    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Claro')).toBeInTheDocument();
      expect(screen.getByText('Oscuro')).toBeInTheDocument();
      expect(screen.getByText('Sistema')).toBeInTheDocument();
      expect(screen.getByText('Por defecto')).toBeInTheDocument();
    });
  });

  it('should handle theme change', async () => {
    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Claro')).toBeInTheDocument();
    });

    // Click on light theme
    fireEvent.click(screen.getByText('Claro').closest('div'));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith('/user/settings/theme', { theme: 'light' });
      expect(mockOnNotification).toHaveBeenCalledWith('Tema actualizado correctamente', 'success');
    });
  });

  it('should handle Roastr Persona field editing', async () => {
    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Lo que me define')).toBeInTheDocument();
    });

    // Find and click the "Editar" button for "Lo que me define"
    const editButtons = screen.getAllByText('Editar');
    fireEvent.click(editButtons[0]);

    // Should show the form
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Soy desarrollador/)).toBeInTheDocument();
    });
  });

  it('should handle copy bio text functionality', async () => {
    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Texto sugerido para tu bio')).toBeInTheDocument();
    });

    // Click copy button
    fireEvent.click(screen.getByText('Copiar'));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('🤖 Algunas respuestas pueden ser generadas por IA');
      expect(mockOnNotification).toHaveBeenCalledWith('Texto copiado al portapapeles', 'success');
    });
  });

  it('should handle API errors gracefully', async () => {
    apiClient.get.mockRejectedValue(new Error('API Error'));

    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(mockOnNotification).toHaveBeenCalledWith('Error al cargar la configuración', 'error');
    });
  });

  it('should handle theme change errors', async () => {
    apiClient.patch.mockRejectedValue(new Error('Update failed'));

    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Claro')).toBeInTheDocument();
    });

    // Click on light theme
    fireEvent.click(screen.getByText('Claro').closest('div'));

    await waitFor(() => {
      expect(mockOnNotification).toHaveBeenCalledWith('Error al actualizar el tema', 'error');
    });
  });

  it('should handle Roastr Persona save errors', async () => {
    apiClient.post.mockRejectedValue(new Error('Save failed'));

    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Lo que me define')).toBeInTheDocument();
    });

    // Open edit form
    const editButtons = screen.getAllByText('Editar');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Soy desarrollador/)).toBeInTheDocument();
    });

    // Try to save
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(mockOnNotification).toHaveBeenCalledWith('Error al guardar Roastr Persona', 'error');
    });
  });

  it('should include TransparencySettings component', async () => {
    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByTestId('transparency-settings')).toBeInTheDocument();
    });
  });

  it('should show bio text only when available', async () => {
    // Test without bio text
    const mockResponseWithoutBio = {
      ...mockApiResponses.transparency,
      data: { ...mockApiResponses.transparency.data, bio_text: null }
    };

    apiClient.get.mockImplementation((url) => {
      if (url === '/user/settings/transparency-mode') {
        return Promise.resolve(mockResponseWithoutBio);
      }

      // Derive a reliable key and provide safe fallback
      const key = url.split('/').pop();
      if (mockApiResponses.hasOwnProperty(key)) {
        return Promise.resolve(mockApiResponses[key]);
      }
      if (mockApiResponses.hasOwnProperty(url)) {
        return Promise.resolve(mockApiResponses[url]);
      }

      // Safe fallback to prevent undefined responses
      return Promise.resolve(mockResponseWithoutBio);
    });

    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Transparencia')).toBeInTheDocument();
    });

    // Should not show bio text section
    expect(screen.queryByText('Texto sugerido para tu bio')).not.toBeInTheDocument();
  });

  it('should disable theme options while saving', async () => {
    // Mock a slow API response
    apiClient.patch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Claro')).toBeInTheDocument();
    });

    // Click on light theme
    fireEvent.click(screen.getByText('Claro').closest('div'));

    // Should disable all theme options
    const themeOptions = screen.getAllByText(/Claro|Oscuro|Sistema/);
    themeOptions.forEach(option => {
      expect(option.closest('div')).toHaveClass('opacity-50', 'cursor-not-allowed');
    });
  });

  it('should validate field character limits', async () => {
    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Lo que me define')).toBeInTheDocument();
    });

    // Open edit form
    const editButtons = screen.getAllByText('Editar');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      const textarea = screen.getByPlaceholderText(/Soy desarrollador/);
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('maxLength', '300');
    });
  });
});
