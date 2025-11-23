import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TransparencySettings from '../TransparencySettings';
import { apiClient } from '../../lib/api';

// Mock dependencies
jest.mock('../../lib/api', () => ({
  apiClient: {
    get: jest.fn(),
    patch: jest.fn()
  }
}));

jest.mock('../../hooks/useI18n', () => ({
  useI18n: () => ({
    t: (key) => key // Simple mock that returns the key
  })
}));

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(() => Promise.resolve())
  }
});

describe('TransparencySettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockTransparencyResponse = {
    data: {
      success: true,
      data: {
        transparency_mode: 'bio',
        bio_text: 'Algunos mensajes de hate son respondidos automáticamente por @Roastr'
      }
    }
  };

  it('should render loading state initially', () => {
    // Mock API to never resolve
    apiClient.get.mockImplementation(() => new Promise(() => {}));

    render(<TransparencySettings />);

    // In loading state, the title won't be visible, only the skeleton
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should load and display transparency settings', async () => {
    apiClient.get.mockResolvedValue(mockTransparencyResponse);

    render(<TransparencySettings />);

    await waitFor(() => {
      expect(screen.getByText('Transparencia de IA')).toBeInTheDocument();
    });

    // Should show all three transparency options
    expect(screen.getByText('Aviso en Bio (recomendado)')).toBeInTheDocument();
    expect(screen.getByText('Firma clásica')).toBeInTheDocument();
    expect(screen.getByText('Disclaimers creativos')).toBeInTheDocument();

    // Should show bio text when bio mode is selected
    expect(screen.getByText('Texto recomendado para tu bio')).toBeInTheDocument();
    expect(
      screen.getByText('Algunos mensajes de hate son respondidos automáticamente por @Roastr')
    ).toBeInTheDocument();
  });

  it('should update transparency mode when option is clicked', async () => {
    apiClient.get.mockResolvedValue(mockTransparencyResponse);
    apiClient.patch.mockResolvedValue({
      data: {
        success: true,
        data: {
          transparency_mode: 'signature',
          bio_text: null
        }
      }
    });

    render(<TransparencySettings />);

    await waitFor(() => {
      expect(screen.getByText('Firma clásica')).toBeInTheDocument();
    });

    // Click on signature mode
    fireEvent.click(screen.getByText('Firma clásica'));

    await waitFor(() => {
      expect(apiClient.patch).toHaveBeenCalledWith('/user/settings/transparency-mode', {
        mode: 'signature'
      });
    });
  });

  it('should copy bio text to clipboard', async () => {
    apiClient.get.mockResolvedValue(mockTransparencyResponse);

    render(<TransparencySettings />);

    await waitFor(() => {
      expect(screen.getByText('Copiar texto')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Copiar texto'));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Algunos mensajes de hate son respondidos automáticamente por @Roastr'
      );
      expect(screen.getByText('¡Copiado!')).toBeInTheDocument();
    });
  });

  it('should show appropriate preview based on selected mode', async () => {
    apiClient.get.mockResolvedValue(mockTransparencyResponse);

    render(<TransparencySettings />);

    await waitFor(() => {
      expect(screen.getByText('Vista previa de respuestas')).toBeInTheDocument();
    });

    // Bio mode preview
    expect(screen.getByText('Modo Bio: Sin modificación en el roast')).toBeInTheDocument();
  });

  it('should handle signature mode correctly', async () => {
    const signatureResponse = {
      data: {
        success: true,
        data: {
          transparency_mode: 'signature',
          bio_text: null
        }
      }
    };

    apiClient.get.mockResolvedValue(signatureResponse);

    render(<TransparencySettings />);

    await waitFor(() => {
      expect(screen.getByText('Vista previa de respuestas')).toBeInTheDocument();
    });

    // Should not show bio text section
    expect(screen.queryByText('Texto recomendado para tu bio')).not.toBeInTheDocument();

    // Should show signature preview
    expect(screen.getByText('— Generado por Roastr.AI')).toBeInTheDocument();
    expect(screen.getByText('Firma clásica añadida')).toBeInTheDocument();
  });

  it('should handle creative mode correctly', async () => {
    const creativeResponse = {
      data: {
        success: true,
        data: {
          transparency_mode: 'creative',
          bio_text: null
        }
      }
    };

    apiClient.get.mockResolvedValue(creativeResponse);

    render(<TransparencySettings />);

    await waitFor(() => {
      expect(screen.getByText('Vista previa de respuestas')).toBeInTheDocument();
    });

    // Should not show bio text section
    expect(screen.queryByText('Texto recomendado para tu bio')).not.toBeInTheDocument();

    // Should show creative preview
    expect(
      screen.getByText(
        'Este roast fue generado por IA. Tranquilo: ningún humano perdió tiempo en ti.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Disclaimer creativo aleatorio')).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    apiClient.get.mockRejectedValue(new Error('API Error'));

    render(<TransparencySettings />);

    await waitFor(() => {
      expect(
        screen.getByText('Error al cargar la configuración de transparencia')
      ).toBeInTheDocument();
    });
  });

  it('should handle update errors gracefully', async () => {
    apiClient.get.mockResolvedValue(mockTransparencyResponse);
    apiClient.patch.mockRejectedValue(new Error('Update failed'));

    render(<TransparencySettings />);

    await waitFor(() => {
      expect(screen.getByText('Firma clásica')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Firma clásica'));

    await waitFor(() => {
      expect(
        screen.getByText('Error al actualizar la configuración de transparencia')
      ).toBeInTheDocument();
    });
  });

  it('should show default badge on bio option', async () => {
    apiClient.get.mockResolvedValue(mockTransparencyResponse);

    render(<TransparencySettings />);

    await waitFor(() => {
      expect(screen.getByText('Por defecto')).toBeInTheDocument();
    });
  });

  it('should show saving state when updating', async () => {
    apiClient.get.mockResolvedValue(mockTransparencyResponse);

    // Make patch request hang to simulate loading
    apiClient.patch.mockImplementation(() => new Promise(() => {}));

    render(<TransparencySettings />);

    await waitFor(() => {
      expect(screen.getByText('Firma clásica')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Firma clásica'));

    await waitFor(() => {
      expect(screen.getByText('Guardando...')).toBeInTheDocument();
    });
  });

  it('should clear success/error messages after delay', async () => {
    jest.useFakeTimers();

    apiClient.get.mockResolvedValue(mockTransparencyResponse);
    apiClient.patch.mockResolvedValue({
      data: {
        success: true,
        data: { transparency_mode: 'signature', bio_text: null }
      }
    });

    render(<TransparencySettings />);

    await waitFor(() => {
      expect(screen.getByText('Firma clásica')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Firma clásica'));

    await waitFor(() => {
      expect(
        screen.getByText('Configuración de transparencia actualizada correctamente')
      ).toBeInTheDocument();
    });

    // Fast forward 5 seconds
    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(
        screen.queryByText('Configuración de transparencia actualizada correctamente')
      ).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });
});
