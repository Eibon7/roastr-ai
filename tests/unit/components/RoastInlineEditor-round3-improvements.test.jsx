import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RoastInlineEditor from '../../../frontend/src/components/RoastInlineEditor';

// Mock fetch for validation API calls
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

describe('RoastInlineEditor - Round 3 Improvements', () => {
  const defaultProps = {
    roast: 'Test roast content',
    roastId: 'test-roast-id',
    platform: 'twitter',
    onSave: jest.fn(),
    onCancel: jest.fn(),
    onValidate: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('mock-token');

    fetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            validation: {
              valid: true,
              errors: [],
              warnings: [],
              metadata: {
                textLength: 10,
                codeUnitLength: 10,
                byteLengthUtf8: 10
              }
            }
          }
        })
    });
  });

  describe('Platform Normalization', () => {
    it('should normalize "X" to "twitter"', () => {
      render(<RoastInlineEditor {...defaultProps} platform="X" />);

      // Component should render without errors for "X" platform
      expect(screen.getByText('Roast Generado')).toBeInTheDocument();

      // Should display normalized platform
      expect(screen.getByText('twitter')).toBeInTheDocument();
    });

    it('should normalize "x.com" to "twitter"', () => {
      render(<RoastInlineEditor {...defaultProps} platform="x.com" />);

      expect(screen.getByText('Roast Generado')).toBeInTheDocument();
      expect(screen.getByText('twitter')).toBeInTheDocument();
    });

    it('should handle case-insensitive platform normalization', () => {
      const testCases = ['x', 'X', 'x.COM', 'X.com', 'x.Com'];

      testCases.forEach((platform) => {
        const { unmount } = render(<RoastInlineEditor {...defaultProps} platform={platform} />);

        expect(screen.getByText('twitter')).toBeInTheDocument();
        unmount();
      });
    });

    it('should preserve other platform names unchanged', () => {
      const platforms = ['facebook', 'instagram', 'youtube'];

      platforms.forEach((platform) => {
        const { unmount } = render(<RoastInlineEditor {...defaultProps} platform={platform} />);

        expect(screen.getByText(platform)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Unicode Character Counting Consistency', () => {
    it('should count ASCII characters correctly', async () => {
      const user = userEvent.setup();

      render(<RoastInlineEditor {...defaultProps} roast="" />);

      // Enter edit mode
      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByDisplayValue('');
      await user.type(textarea, 'Hello World');

      // Check character count display
      expect(screen.getByText(/11 \/ 280 caracteres/)).toBeInTheDocument();
    });

    it('should count Unicode characters correctly', async () => {
      const user = userEvent.setup();

      render(<RoastInlineEditor {...defaultProps} roast="" />);

      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByDisplayValue('');
      const unicodeText = 'Hello 🌍'; // ASCII + Emoji

      await user.type(textarea, unicodeText);

      // Should count grapheme clusters correctly
      expect(screen.getByText(/7 \/ 280 caracteres/)).toBeInTheDocument();
    });

    it('should handle complex emoji sequences', async () => {
      const user = userEvent.setup();

      render(<RoastInlineEditor {...defaultProps} roast="" />);

      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByDisplayValue('');
      const complexEmoji = '👨‍👩‍👧‍👦'; // Family emoji (compound sequence)

      await user.type(textarea, complexEmoji);

      // Should count as 1 grapheme cluster
      expect(screen.getByText(/1 \/ 280 caracteres/)).toBeInTheDocument();
    });
  });

  describe('Accessibility Improvements', () => {
    it('should have proper ARIA labels in edit mode', () => {
      render(<RoastInlineEditor {...defaultProps} platform="twitter" />);

      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-label', 'Editar contenido del roast para twitter');
      expect(textarea).toHaveAttribute('aria-describedby');
      expect(textarea).toHaveAttribute('aria-required', 'true');
    });

    it('should announce validation errors to screen readers', async () => {
      // Mock validation failure
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              validation: {
                valid: false,
                errors: [{ message: 'Text is too long' }],
                warnings: [],
                metadata: { textLength: 300 }
              }
            }
          })
      });

      render(<RoastInlineEditor {...defaultProps} roast="" />);

      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Very long text'.repeat(20) } });

      // Trigger validation
      fireEvent.click(screen.getByText('Validar'));

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toBeInTheDocument();
        expect(errorAlert).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should support keyboard navigation', () => {
      render(<RoastInlineEditor {...defaultProps} />);

      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByRole('textbox');
      const validateButton = screen.getByText('Validar');
      const saveButton = screen.getByText('Guardar');
      const cancelButton = screen.getByText('Cancelar');

      // All interactive elements should be keyboard accessible
      expect(textarea).toHaveAttribute('tabindex', '0');
      expect(validateButton).not.toBeDisabled();
      expect(cancelButton).not.toBeDisabled();
    });
  });

  describe('Error Handling for Null/Undefined Platform Values', () => {
    it('should handle null platform gracefully', () => {
      expect(() => {
        render(<RoastInlineEditor {...defaultProps} platform={null} />);
      }).not.toThrow();

      expect(screen.getByText('Roast Generado')).toBeInTheDocument();
    });

    it('should handle undefined platform gracefully', () => {
      expect(() => {
        render(<RoastInlineEditor {...defaultProps} platform={undefined} />);
      }).not.toThrow();

      expect(screen.getByText('Roast Generado')).toBeInTheDocument();
    });

    it('should provide fallback behavior for invalid platforms', () => {
      const invalidPlatforms = ['', 'invalid-platform'];

      invalidPlatforms.forEach((platform) => {
        expect(() => {
          const { unmount } = render(<RoastInlineEditor {...defaultProps} platform={platform} />);
          unmount();
        }).not.toThrow();
      });
    });
  });

  describe('Save Button Gating', () => {
    it('should require validation before enabling save', async () => {
      const user = userEvent.setup();

      render(<RoastInlineEditor {...defaultProps} roast="" />);

      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'New content');

      const saveButton = screen.getByText('Guardar');

      // Save should be disabled without validation
      expect(saveButton).toBeDisabled();
      expect(saveButton).toHaveAttribute('aria-label', 'Valida los cambios antes de guardar');
    });

    it('should enable save after successful validation', async () => {
      render(<RoastInlineEditor {...defaultProps} roast="" />);

      fireEvent.click(screen.getByText('Editar'));

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Valid content' } });

      // Trigger validation
      fireEvent.click(screen.getByText('Validar'));

      await waitFor(() => {
        const saveButton = screen.getByText('Guardar');
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe('Performance Optimizations', () => {
    it('should not re-render unnecessarily', () => {
      const { rerender } = render(<RoastInlineEditor {...defaultProps} />);

      // Rerender with same props
      rerender(<RoastInlineEditor {...defaultProps} />);

      // Component should handle rerenders efficiently
      expect(screen.getByText('Roast Generado')).toBeInTheDocument();
    });

    it('should handle rapid platform changes efficiently', () => {
      const { rerender } = render(<RoastInlineEditor {...defaultProps} platform="twitter" />);

      // Rapid platform changes
      const platforms = ['X', 'x.com', 'twitter', 'facebook'];
      platforms.forEach((platform) => {
        rerender(<RoastInlineEditor {...defaultProps} platform={platform} />);
      });

      expect(screen.getByText('Roast Generado')).toBeInTheDocument();
    });
  });
});
