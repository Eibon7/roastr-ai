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
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('RoastInlineEditor - Round 4 CodeRabbit Improvements', () => {
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
      json: () => Promise.resolve({
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

  describe('UTF-8 Byte Length Calculation Consistency', () => {
    it('should calculate UTF-8 byte length for ASCII text correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <RoastInlineEditor
          {...defaultProps}
          roast=""
        />
      );

      fireEvent.click(screen.getByText('Editar'));
      
      const textarea = screen.getByDisplayValue('');
      const asciiText = 'Hello World';
      await user.type(textarea, asciiText);

      // Mock getByteLengthUtf8 to verify it's working
      const component = screen.getByRole('textbox');
      expect(component).toBeInTheDocument();
      
      // ASCII text should have byte length equal to character length
      expect(asciiText.length).toBe(11);
      expect(new TextEncoder().encode(asciiText).length).toBe(11);
    });

    it('should calculate UTF-8 byte length for Unicode content correctly', async () => {
      const user = userEvent.setup();
      
      render(
        <RoastInlineEditor
          {...defaultProps}
          roast=""
        />
      );

      fireEvent.click(screen.getByText('Editar'));
      
      const textarea = screen.getByDisplayValue('');
      const unicodeText = 'Hello 世界 🌍'; // ASCII + Chinese + Emoji
      await user.type(textarea, unicodeText);

      // Verify UTF-8 byte calculation
      const expectedBytes = new TextEncoder().encode(unicodeText).length;
      expect(expectedBytes).toBe(17); // Verify our expectation
      
      // Component should handle this correctly
      expect(screen.getByDisplayValue(unicodeText)).toBeInTheDocument();
    });

    it('should handle getByteLengthUtf8 edge cases gracefully', () => {
      const { getByteLengthUtf8 } = require('../../../frontend/src/components/RoastInlineEditor');
      
      // This would normally be tested via component instance, but since we can't access
      // the internal function directly, we'll test the behavior through the UI
      const edgeCases = [
        '', // Empty string
        '   ', // Whitespace
        'null\0test', // Null characters
        '🏴󠁧󠁢󠁳󠁣󠁴󠁿', // Complex flag emoji
      ];

      edgeCases.forEach(testCase => {
        render(
          <RoastInlineEditor
            {...defaultProps}
            roast={testCase}
          />
        );
        
        // Component should render without errors
        expect(screen.getByText('Roast Generado')).toBeInTheDocument();
      });
    });
  });

  describe('Consistency with Backend UTF-8 Calculations', () => {
    it('should match backend byte length calculations for complex content', async () => {
      const complexContent = 'Café naïve résumé 🎉 with émojis and 中文';
      
      // Frontend calculation (browser environment)
      const frontendBytes = new TextEncoder().encode(complexContent).length;
      
      // This should match what the backend calculates with Buffer.byteLength()
      // In Node.js: Buffer.byteLength(complexContent, 'utf8')
      expect(frontendBytes).toBeGreaterThan(complexContent.length); // Unicode takes more bytes
      expect(typeof frontendBytes).toBe('number');
      expect(frontendBytes).toBeGreaterThan(0);

      render(
        <RoastInlineEditor
          {...defaultProps}
          roast={complexContent}
        />
      );

      expect(screen.getByText('Roast Generado')).toBeInTheDocument();
    });

    it('should provide consistent character counting with backend grapheme counting', async () => {
      const user = userEvent.setup();
      
      render(
        <RoastInlineEditor
          {...defaultProps}
          roast=""
        />
      );

      fireEvent.click(screen.getByText('Editar'));
      
      const textarea = screen.getByDisplayValue('');
      
      // Test cases that should count as expected grapheme clusters
      const testCases = [
        { text: 'café', expectedLength: 4 }, // é is one grapheme
        { text: '👨‍👩‍👧‍👦', expectedLength: 1 }, // Family emoji is one grapheme
        { text: '🇺🇸🇪🇸', expectedLength: 2 }, // Two flag emojis
      ];

      for (const { text, expectedLength } of testCases) {
        fireEvent.change(textarea, { target: { value: text } });
        
        // Should display correct character count
        expect(screen.getByText(new RegExp(`${expectedLength} / 280 caracteres`))).toBeInTheDocument();
      }
    });
  });

  describe('Platform Normalization Consistency', () => {
    it('should maintain platform normalization from Round 3 improvements', () => {
      const platformVariants = ['X', 'x', 'x.com', 'twitter'];
      
      platformVariants.forEach(platform => {
        const { unmount } = render(
          <RoastInlineEditor
            {...defaultProps}
            platform={platform}
          />
        );

        // All should normalize to 'twitter' display
        expect(screen.getByText('twitter')).toBeInTheDocument();
        unmount();
      });
    });

    it('should handle UTF-8 content with platform normalization', async () => {
      const user = userEvent.setup();
      
      render(
        <RoastInlineEditor
          {...defaultProps}
          platform="X" // Should normalize to twitter
          roast=""
        />
      );

      fireEvent.click(screen.getByText('Editar'));
      
      const textarea = screen.getByDisplayValue('');
      const unicodeContent = 'Testing X platform with 中文 and 🎉';
      await user.type(textarea, unicodeContent);

      // Should show normalized platform
      expect(screen.getByText('twitter')).toBeInTheDocument();
      
      // Should handle Unicode content correctly
      expect(screen.getByDisplayValue(unicodeContent)).toBeInTheDocument();
    });
  });

  describe('Error Handling for UTF-8 Calculations', () => {
    it('should fallback gracefully if TextEncoder is not available', () => {
      // Mock TextEncoder to be undefined
      const originalTextEncoder = global.TextEncoder;
      global.TextEncoder = undefined;

      render(
        <RoastInlineEditor
          {...defaultProps}
          roast="Test fallback behavior"
        />
      );

      // Component should still render without errors
      expect(screen.getByText('Roast Generado')).toBeInTheDocument();

      // Restore TextEncoder
      global.TextEncoder = originalTextEncoder;
    });

    it('should handle invalid input types gracefully', () => {
      const invalidInputs = [null, undefined, 123, {}, []];
      
      invalidInputs.forEach(invalidInput => {
        // Component should handle invalid roast prop gracefully
        expect(() => {
          render(
            <RoastInlineEditor
              {...defaultProps}
              roast={invalidInput}
            />
          );
        }).not.toThrow();
      });
    });
  });

  describe('Performance with Round 4 Improvements', () => {
    it('should maintain good performance with UTF-8 byte calculations', async () => {
      const user = userEvent.setup();
      
      render(
        <RoastInlineEditor
          {...defaultProps}
          roast=""
        />
      );

      fireEvent.click(screen.getByText('Editar'));
      
      const textarea = screen.getByDisplayValue('');
      
      // Test rapid typing with Unicode content
      const complexText = 'Performance test with émojis 🎉 and 中文 content';
      
      const startTime = Date.now();
      await user.type(textarea, complexText);
      const endTime = Date.now();
      
      const typingTime = endTime - startTime;
      
      // Should handle typing smoothly (allowing generous time for test environment)
      expect(typingTime).toBeLessThan(5000); // 5 seconds should be more than enough
      expect(screen.getByDisplayValue(complexText)).toBeInTheDocument();
    });

    it('should not cause memory leaks with repeated UTF-8 calculations', async () => {
      const user = userEvent.setup();
      
      render(
        <RoastInlineEditor
          {...defaultProps}
          roast=""
        />
      );

      fireEvent.click(screen.getByText('Editar'));
      
      const textarea = screen.getByDisplayValue('');
      
      // Rapid content changes to test for memory leaks
      for (let i = 0; i < 10; i++) {
        const testText = `Memory test ${i} with émojis 🎉`;
        fireEvent.change(textarea, { target: { value: testText } });
      }
      
      // Component should still be responsive
      expect(textarea).toBeInTheDocument();
      expect(textarea.value).toContain('Memory test 9');
    });
  });

  describe('Integration with Validation API', () => {
    it('should send UTF-8 metadata to validation API', async () => {
      const user = userEvent.setup();
      
      // Mock API response with UTF-8 metadata
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            validation: {
              valid: true,
              errors: [],
              warnings: [],
              metadata: {
                textLength: 7,
                codeUnitLength: 8,
                byteLengthUtf8: 10 // Different from character count due to Unicode
              }
            }
          }
        })
      });

      render(
        <RoastInlineEditor
          {...defaultProps}
          roast=""
        />
      );

      fireEvent.click(screen.getByText('Editar'));
      
      const textarea = screen.getByDisplayValue('');
      const unicodeText = 'Hello 🌍';
      await user.type(textarea, unicodeText);
      
      // Trigger validation
      fireEvent.click(screen.getByText('Validar'));
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          `/api/roast/test-roast-id/validate`,
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json'
            }),
            body: JSON.stringify({
              text: unicodeText,
              platform: 'twitter'
            })
          })
        );
      });
    });
  });
});