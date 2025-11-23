/**
 * Tests for RoastInlineEditor Component - SPEC 8 Issue #364
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RoastInlineEditor from '../RoastInlineEditor';

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

describe('RoastInlineEditor', () => {
  const defaultProps = {
    roast: 'Este es un roast de prueba',
    roastId: 'test-roast-123',
    platform: 'twitter',
    onSave: jest.fn(),
    onCancel: jest.fn(),
    onValidate: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-auth-token');
    fetch.mockClear();
  });

  describe('View Mode Rendering', () => {
    it('should render in view mode by default', () => {
      render(<RoastInlineEditor {...defaultProps} />);

      expect(screen.getByText('Roast Generado')).toBeInTheDocument();
      expect(screen.getByText('Este es un roast de prueba')).toBeInTheDocument();
      expect(screen.getByText('Editar')).toBeInTheDocument();
      expect(screen.getByText('twitter')).toBeInTheDocument();
    });

    it('should show character count in view mode', () => {
      render(<RoastInlineEditor {...defaultProps} />);

      expect(screen.getByText('26 caracteres')).toBeInTheDocument();
      expect(screen.getByText('Límite: 280')).toBeInTheDocument();
    });

    it('should handle empty roast content', () => {
      render(<RoastInlineEditor {...defaultProps} roast="" />);

      expect(screen.getByText('0 caracteres')).toBeInTheDocument();
    });

    it('should display correct platform badge', () => {
      render(<RoastInlineEditor {...defaultProps} platform="instagram" />);

      expect(screen.getByText('instagram')).toBeInTheDocument();
    });
  });

  describe('Edit Mode Transition', () => {
    it('should switch to edit mode when edit button is clicked', () => {
      render(<RoastInlineEditor {...defaultProps} />);

      fireEvent.click(screen.getByText('Editar'));

      expect(screen.getByText('Editor de Roast')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Este es un roast de prueba')).toBeInTheDocument();
      expect(screen.getByText('Guardar')).toBeInTheDocument();
      expect(screen.getByText('Cancelar')).toBeInTheDocument();
    });

    it('should initialize textarea with current roast content', () => {
      render(<RoastInlineEditor {...defaultProps} />);

      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      expect(textarea).toBeInTheDocument();
      expect(textarea.value).toBe('Este es un roast de prueba');
    });
  });

  describe('Text Editing', () => {
    beforeEach(() => {
      render(<RoastInlineEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Editar'));
    });

    it('should update character count as user types', async () => {
      const textarea = screen.getByDisplayValue('Este es un roast de prueba');

      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'Nuevo roast');

      expect(screen.getByText('11 / 280 caracteres')).toBeInTheDocument();
    });

    it('should show unsaved changes badge when text is modified', async () => {
      const textarea = screen.getByDisplayValue('Este es un roast de prueba');

      await userEvent.type(textarea, ' modificado');

      expect(screen.getByText('Cambios sin guardar')).toBeInTheDocument();
    });

    it('should warn when character limit is exceeded', async () => {
      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      const longText = 'a'.repeat(300);

      await userEvent.clear(textarea);
      await userEvent.type(textarea, longText);

      expect(screen.getByText('(¡20 sobre el límite!)')).toBeInTheDocument();
      expect(screen.getByText('300 / 280 caracteres')).toHaveClass('text-red-500');
    });

    it('should show character count warnings at different thresholds', async () => {
      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      const nearLimitText = 'a'.repeat(270);

      await userEvent.clear(textarea);
      await userEvent.type(textarea, nearLimitText);

      expect(screen.getByText('270 / 280 caracteres')).toHaveClass('text-yellow-500');
    });
  });

  describe('Platform-Specific Character Limits', () => {
    it('should use Instagram character limit', () => {
      render(<RoastInlineEditor {...defaultProps} platform="instagram" />);
      fireEvent.click(screen.getByText('Editar'));

      expect(screen.getByText('26 / 2200 caracteres')).toBeInTheDocument();
    });

    it('should use Facebook character limit', () => {
      render(<RoastInlineEditor {...defaultProps} platform="facebook" />);
      fireEvent.click(screen.getByText('Editar'));

      expect(screen.getByText('26 / 63206 caracteres')).toBeInTheDocument();
    });

    it('should default to Twitter limit for unknown platforms', () => {
      render(<RoastInlineEditor {...defaultProps} platform="unknown" />);
      fireEvent.click(screen.getByText('Editar'));

      expect(screen.getByText('26 / 280 caracteres')).toBeInTheDocument();
    });
  });

  describe('Validation API Integration', () => {
    beforeEach(() => {
      render(<RoastInlineEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Editar'));
    });

    it('should call validation API when validate button is clicked', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            validation: {
              valid: true,
              errors: [],
              warnings: [],
              metadata: { textLength: 26 }
            },
            credits: { remaining: 99, limit: 100 }
          }
        })
      });

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.type(textarea, ' editado');

      fireEvent.click(screen.getByText('Validar'));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/roast/test-roast-123/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer mock-auth-token'
          },
          body: JSON.stringify({
            text: 'Este es un roast de prueba editado',
            platform: 'twitter'
          })
        });
      });
    });

    it('should show validation success state', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            validation: {
              valid: true,
              errors: [],
              warnings: [],
              metadata: { textLength: 26 }
            },
            credits: { remaining: 99 }
          }
        })
      });

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.type(textarea, ' válido');

      fireEvent.click(screen.getByText('Validar'));

      await waitFor(() => {
        expect(screen.getByText('Válido')).toBeInTheDocument();
        expect(screen.getByText('¡Listo para guardar!')).toBeInTheDocument();
      });
    });

    it('should show validation errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            validation: {
              valid: false,
              errors: [
                { rule: 'CHARACTER_LIMIT', message: 'Texto demasiado largo' },
                { rule: 'NO_SPAM', message: 'Contenido repetitivo detectado' }
              ],
              warnings: [],
              metadata: { textLength: 300 }
            },
            credits: { remaining: 98 }
          }
        })
      });

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'a'.repeat(300));

      fireEvent.click(screen.getByText('Validar'));

      await waitFor(() => {
        expect(screen.getByText('Inválido')).toBeInTheDocument();
        expect(screen.getByText('Problemas encontrados:')).toBeInTheDocument();
        expect(screen.getByText('Texto demasiado largo')).toBeInTheDocument();
        expect(screen.getByText('Contenido repetitivo detectado')).toBeInTheDocument();
      });
    });

    it('should show validation warnings', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            validation: {
              valid: true,
              errors: [],
              warnings: [{ rule: 'STYLE_WARNING', message: 'Considera mejorar el estilo' }],
              metadata: { textLength: 26 }
            },
            credits: { remaining: 99 }
          }
        })
      });

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.type(textarea, ' con advertencia');

      fireEvent.click(screen.getByText('Validar'));

      await waitFor(() => {
        expect(screen.getByText('Advertencias:')).toBeInTheDocument();
        expect(screen.getByText('Considera mejorar el estilo')).toBeInTheDocument();
      });
    });

    it('should handle validation API errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 402,
        json: async () => ({
          error: 'Insufficient credits'
        })
      });

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.type(textarea, ' sin créditos');

      fireEvent.click(screen.getByText('Validar'));

      await waitFor(() => {
        expect(screen.getByText('Sin Créditos')).toBeInTheDocument();
        expect(screen.getByText('Insufficient credits')).toBeInTheDocument();
        expect(screen.getByText('La validación consume 1 crédito por uso')).toBeInTheDocument();
      });
    });

    it('should handle network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.type(textarea, ' error de red');

      fireEvent.click(screen.getByText('Validar'));

      await waitFor(() => {
        expect(screen.getByText('Error de Red')).toBeInTheDocument();
        expect(
          screen.getByText('Network error. Please check your connection.')
        ).toBeInTheDocument();
      });
    });

    it('should disable validation button when no changes', () => {
      const validateButton = screen.getByText('Validar');
      expect(validateButton).toBeDisabled();
    });

    it('should disable validation button when text is empty', async () => {
      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.clear(textarea);

      const validateButton = screen.getByText('Validar');
      expect(validateButton).toBeDisabled();
    });

    it('should show loading state during validation', async () => {
      // Mock a slow API response
      fetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    success: true,
                    data: { validation: { valid: true, errors: [], warnings: [] } }
                  })
                }),
              100
            );
          })
      );

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.type(textarea, ' cargando');

      fireEvent.click(screen.getByText('Validar'));

      expect(screen.getByText('Validando...')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Validar')).toBeInTheDocument();
      });
    });
  });

  describe('Save and Cancel Actions', () => {
    beforeEach(() => {
      render(<RoastInlineEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Editar'));
    });

    it('should call onSave when save button is clicked', async () => {
      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.type(textarea, ' guardado');

      fireEvent.click(screen.getByText('Guardar'));

      expect(defaultProps.onSave).toHaveBeenCalledWith('Este es un roast de prueba guardado', null);
    });

    it('should call onCancel when cancel button is clicked', () => {
      fireEvent.click(screen.getByText('Cancelar'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });

    it('should disable save button when no changes', () => {
      const saveButton = screen.getByText('Guardar');
      expect(saveButton).toBeDisabled();
    });

    it('should disable save button when text exceeds character limit', async () => {
      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'a'.repeat(300));

      const saveButton = screen.getByText('Guardar');
      expect(saveButton).toBeDisabled();
    });

    it('should reset state when cancelled', () => {
      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      userEvent.type(textarea, ' modificado');

      fireEvent.click(screen.getByText('Cancelar'));

      expect(defaultProps.onCancel).toHaveBeenCalled();
    });
  });

  describe('Credit Display and Warnings', () => {
    beforeEach(() => {
      render(<RoastInlineEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Editar'));
    });

    it('should show credit cost on validation button', () => {
      expect(screen.getByText('1 crédito')).toBeInTheDocument();
    });

    it('should call onValidate callback with credit info', async () => {
      const mockCredits = { remaining: 95, limit: 100 };
      const mockValidation = { valid: true, errors: [], warnings: [] };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            validation: mockValidation,
            credits: mockCredits
          }
        })
      });

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.type(textarea, ' con callback');

      fireEvent.click(screen.getByText('Validar'));

      await waitFor(() => {
        expect(defaultProps.onValidate).toHaveBeenCalledWith(mockValidation, mockCredits);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<RoastInlineEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      expect(textarea).toHaveAttribute('placeholder', 'Edita tu roast aquí...');

      // Check button accessibility
      const validateButton = screen.getByText('Validar');
      expect(validateButton).toBeInTheDocument();

      const saveButton = screen.getByText('Guardar');
      expect(saveButton).toBeInTheDocument();

      const cancelButton = screen.getByText('Cancelar');
      expect(cancelButton).toBeInTheDocument();
    });

    it('should handle keyboard navigation', () => {
      render(<RoastInlineEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');

      // Test that textarea can receive focus
      textarea.focus();
      expect(document.activeElement).toBe(textarea);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing roast prop', () => {
      render(<RoastInlineEditor {...defaultProps} roast={null} />);

      expect(screen.getByText('0 caracteres')).toBeInTheDocument();
    });

    it('should handle missing roastId', () => {
      render(<RoastInlineEditor {...defaultProps} roastId={null} />);
      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      userEvent.type(textarea, ' sin ID');

      const validateButton = screen.getByText('Validar');
      expect(validateButton).toBeDisabled(); // Should be disabled without roastId
    });

    it('should handle missing authentication token', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      render(<RoastInlineEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.type(textarea, ' sin auth');

      fireEvent.click(screen.getByText('Validar'));

      await waitFor(() => {
        expect(screen.getByText('Error de Autenticación')).toBeInTheDocument();
      });
    });

    it('should clear validation when text changes significantly', async () => {
      // First, set up a validation result
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            validation: { valid: true, errors: [], warnings: [], metadata: { textLength: 26 } },
            credits: { remaining: 99 }
          }
        })
      });

      render(<RoastInlineEditor {...defaultProps} />);
      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByDisplayValue('Este es un roast de prueba');
      await userEvent.type(textarea, ' validated');

      fireEvent.click(screen.getByText('Validar'));

      await waitFor(() => {
        expect(screen.getByText('Válido')).toBeInTheDocument();
      });

      // Now change the text significantly (more than 10 characters)
      await userEvent.clear(textarea);
      await userEvent.type(textarea, 'Completely different text that is much longer');

      // The validation badge should disappear
      expect(screen.queryByText('Válido')).not.toBeInTheDocument();
    });
  });
});
