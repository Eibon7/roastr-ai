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
      expect(screen.getByDisplayValue('Soy desarrollador')).toBeInTheDocument();
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

  it('should show permission error when clipboard write is not allowed', async () => {
    // Make writeText reject with NotAllowedError
    const originalWriteText = navigator.clipboard.writeText;
    navigator.clipboard.writeText = jest.fn().mockRejectedValue(Object.assign(new Error('NotAllowedError'), { name: 'NotAllowedError' }));

    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Texto sugerido para tu bio')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Copiar'));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(mockOnNotification).toHaveBeenCalledWith(expect.stringContaining('Permisos de portapapeles denegados'), 'error');
    });

    // Restore original
    navigator.clipboard.writeText = originalWriteText;
  });

  it('should show generic error when clipboard write fails', async () => {
    const originalWriteText = navigator.clipboard.writeText;
    navigator.clipboard.writeText = jest.fn().mockRejectedValue(new Error('copy failed'));

    render(<AjustesSettings user={mockUser} onNotification={mockOnNotification} />);

    await waitFor(() => {
      expect(screen.getByText('Texto sugerido para tu bio')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Copiar'));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
      expect(mockOnNotification).toHaveBeenCalledWith(expect.stringContaining('Error al copiar'), 'error');
    });

    navigator.clipboard.writeText = originalWriteText;
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
      expect(screen.getByDisplayValue('Soy desarrollador')).toBeInTheDocument();
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

    // Create a Map with canonical paths for simplified lookup
    const responseMap = new Map();

    // Populate the map with canonical paths
    Object.entries(mockApiResponses).forEach(([key, value]) => {
      responseMap.set(key, value);
    });

    // Add the special case for transparency-mode
    responseMap.set('/user/settings/transparency-mode', mockResponseWithoutBio);

    apiClient.get.mockImplementation((url) => {
      // Normalize the incoming request to a canonical pathname
      let canonicalPath;
      try {
        // Try URL constructor first (handles full URLs)
        const urlObj = new URL(url, 'http://localhost');
        canonicalPath = urlObj.pathname;
      } catch {
        // Fallback to treating as pathname directly
        canonicalPath = url;
      }

      // Single Map lookup
      const response = responseMap.get(canonicalPath);
      if (response) {
        return Promise.resolve(response);
      }

      // Reject if not found
      return Promise.reject(new Error(`Unexpected mock request: ${url}`));
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
      const textarea = screen.getByDisplayValue('Soy desarrollador');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute('maxLength', '300');
    });
  });
});
