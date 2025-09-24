/**
 * StyleAnalysisChart Component Tests
 * Issue #369 - SPEC 9 - Style Profile Extraction
 * 
 * Tests cover:
 * - Metadata display
 * - Tone and style indicators
 * - Engagement metrics visualization
 * - Language support
 * - Progress bars and visual elements
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { jest } from '@jest/globals';
import StyleAnalysisChart from '../StyleAnalysisChart';

const mockMetadata = {
  dominantTone: 'casual',
  styleType: 'short',
  avgLength: 75,
  emojiUsage: 1.2,
  questionRate: 15,
  exclamationRate: 25
};

describe('StyleAnalysisChart', () => {
  describe('Basic Rendering', () => {
    it('should render nothing when metadata is not provided', () => {
      const { container } = render(<StyleAnalysisChart />);
      expect(container.firstChild).toBeNull();
    });

    it('should render analysis chart when metadata is provided', () => {
      render(<StyleAnalysisChart metadata={mockMetadata} />);

      expect(screen.getByText('📊 Análisis de estilo')).toBeInTheDocument();
    });
  });

  describe('Language Support', () => {
    it('should display Spanish labels by default', () => {
      render(<StyleAnalysisChart metadata={mockMetadata} />);

      expect(screen.getByText('📊 Análisis de estilo')).toBeInTheDocument();
      expect(screen.getByText('Tono dominante')).toBeInTheDocument();
      expect(screen.getByText('Estilo de escritura')).toBeInTheDocument();
      expect(screen.getByText('Longitud promedio')).toBeInTheDocument();
    });

    it('should display English labels when language is set to en', () => {
      render(<StyleAnalysisChart metadata={mockMetadata} language="en" />);

      expect(screen.getByText('📊 Style Analysis')).toBeInTheDocument();
      expect(screen.getByText('Dominant tone')).toBeInTheDocument();
      expect(screen.getByText('Writing style')).toBeInTheDocument();
      expect(screen.getByText('Average length')).toBeInTheDocument();
    });
  });

  describe('Tone Display', () => {
    it('should display dominant tone correctly in Spanish', () => {
      render(<StyleAnalysisChart metadata={mockMetadata} language="es" />);

      expect(screen.getByText('Casual')).toBeInTheDocument();
    });

    it('should display different tones correctly', () => {
      const tones = [
        { tone: 'formal', expectedSpanish: 'Formal', expectedEnglish: 'Formal' },
        { tone: 'humorous', expectedSpanish: 'Divertido', expectedEnglish: 'Humorous' },
        { tone: 'sarcastic', expectedSpanish: 'Sarcástico', expectedEnglish: 'Sarcastic' },
        { tone: 'friendly', expectedSpanish: 'Amigable', expectedEnglish: 'Friendly' }
      ];

      tones.forEach(({ tone, expectedSpanish, expectedEnglish }) => {
        const { unmount } = render(
          <StyleAnalysisChart 
            metadata={{ ...mockMetadata, dominantTone: tone }} 
            language="es" 
          />
        );
        expect(screen.getByText(expectedSpanish)).toBeInTheDocument();
        unmount();

        render(
          <StyleAnalysisChart 
            metadata={{ ...mockMetadata, dominantTone: tone }} 
            language="en" 
          />
        );
        expect(screen.getByText(expectedEnglish)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Style Type Display', () => {
    it('should display writing style correctly', () => {
      render(<StyleAnalysisChart metadata={mockMetadata} language="es" />);

      expect(screen.getByText('Conciso')).toBeInTheDocument();
    });

    it('should display different style types correctly', () => {
      const styles = [
        { style: 'medium', expectedSpanish: 'Equilibrado', expectedEnglish: 'Balanced' },
        { style: 'long', expectedSpanish: 'Detallado', expectedEnglish: 'Detailed' }
      ];

      styles.forEach(({ style, expectedSpanish, expectedEnglish }) => {
        const { unmount } = render(
          <StyleAnalysisChart 
            metadata={{ ...mockMetadata, styleType: style }} 
            language="es" 
          />
        );
        expect(screen.getByText(expectedSpanish)).toBeInTheDocument();
        unmount();

        render(
          <StyleAnalysisChart 
            metadata={{ ...mockMetadata, styleType: style }} 
            language="en" 
          />
        );
        expect(screen.getByText(expectedEnglish)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Average Length Display', () => {
    it('should display average length with correct units', () => {
      render(<StyleAnalysisChart metadata={mockMetadata} language="es" />);

      expect(screen.getByText('75 caracteres')).toBeInTheDocument();
    });

    it('should display average length in English', () => {
      render(<StyleAnalysisChart metadata={mockMetadata} language="en" />);

      expect(screen.getByText('75 characters')).toBeInTheDocument();
    });
  });

  describe('Engagement Metrics', () => {
    it('should display all engagement metrics', () => {
      render(<StyleAnalysisChart metadata={mockMetadata} language="es" />);

      expect(screen.getByText('Uso de emojis')).toBeInTheDocument();
      expect(screen.getByText('Frecuencia de preguntas')).toBeInTheDocument();
      expect(screen.getByText('Frecuencia de exclamaciones')).toBeInTheDocument();
    });

    it('should display metric values correctly', () => {
      render(<StyleAnalysisChart metadata={mockMetadata} language="es" />);

      expect(screen.getByText('1.20')).toBeInTheDocument(); // emojiUsage
      expect(screen.getByText('15%')).toBeInTheDocument(); // questionRate
      expect(screen.getByText('25%')).toBeInTheDocument(); // exclamationRate
    });

    it('should display metric icons', () => {
      render(<StyleAnalysisChart metadata={mockMetadata} language="es" />);

      expect(screen.getByText('😊')).toBeInTheDocument(); // emoji icon
      expect(screen.getByText('❓')).toBeInTheDocument(); // question icon
      expect(screen.getByText('❗')).toBeInTheDocument(); // exclamation icon
    });
  });

  describe('Progress Bars', () => {
    it('should render progress bars for engagement metrics', () => {
      render(<StyleAnalysisChart metadata={mockMetadata} language="es" />);

      const progressBars = screen.getAllByRole('generic').filter(el => 
        el.className.includes('rounded-full') && el.className.includes('h-2')
      );

      // Should have at least 3 progress bars (one for each engagement metric)
      expect(progressBars.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Style Interpretation', () => {
    it('should provide interpretation based on metrics', () => {
      render(<StyleAnalysisChart metadata={mockMetadata} language="es" />);

      expect(screen.getByText('🎯 Interpretación')).toBeInTheDocument();
      expect(screen.getByText(/Tu estilo es principalmente/)).toBeInTheDocument();
      expect(screen.getByText(/Casual/)).toBeInTheDocument();
      expect(screen.getByText(/Conciso/)).toBeInTheDocument();
    });

    it('should show interpretation in English', () => {
      render(<StyleAnalysisChart metadata={mockMetadata} language="en" />);

      expect(screen.getByText('🎯 Interpretation')).toBeInTheDocument();
      expect(screen.getByText(/Your style is primarily/)).toBeInTheDocument();
      expect(screen.getByText(/Casual/)).toBeInTheDocument();
      expect(screen.getByText(/Concise/)).toBeInTheDocument();
    });

    it('should include conditional interpretations for high emoji usage', () => {
      const highEmojiMetadata = { ...mockMetadata, emojiUsage: 0.8 };
      render(<StyleAnalysisChart metadata={highEmojiMetadata} language="es" />);

      expect(screen.getByText(/Usas emojis frecuentemente/)).toBeInTheDocument();
    });

    it('should include conditional interpretations for high question rate', () => {
      const highQuestionMetadata = { ...mockMetadata, questionRate: 25 };
      render(<StyleAnalysisChart metadata={highQuestionMetadata} language="es" />);

      expect(screen.getByText(/Tiendes a hacer muchas preguntas/)).toBeInTheDocument();
    });

    it('should include conditional interpretations for high exclamation rate', () => {
      const highExclamationMetadata = { ...mockMetadata, exclamationRate: 35 };
      render(<StyleAnalysisChart metadata={highExclamationMetadata} language="es" />);

      expect(screen.getByText(/Tu comunicación es muy expresiva/)).toBeInTheDocument();
    });
  });

  describe('Missing Values Handling', () => {
    it('should handle missing metric values gracefully', () => {
      const incompleteMetadata = {
        dominantTone: 'casual',
        styleType: 'short',
        avgLength: 75
        // Missing emojiUsage, questionRate, exclamationRate
      };

      render(<StyleAnalysisChart metadata={incompleteMetadata} />);

      expect(screen.getByText('0.00')).toBeInTheDocument(); // Default emojiUsage
      expect(screen.getByText('0%')).toBeInTheDocument(); // Default questionRate and exclamationRate
    });

    it('should handle unknown tone gracefully', () => {
      const unknownToneMetadata = { ...mockMetadata, dominantTone: 'unknown' };
      render(<StyleAnalysisChart metadata={unknownToneMetadata} />);

      expect(screen.getByText('unknown')).toBeInTheDocument();
    });

    it('should handle unknown style type gracefully', () => {
      const unknownStyleMetadata = { ...mockMetadata, styleType: 'unknown' };
      render(<StyleAnalysisChart metadata={unknownStyleMetadata} />);

      expect(screen.getByText('unknown')).toBeInTheDocument();
    });
  });

  describe('Visual Styling', () => {
    it('should apply appropriate CSS classes for tone colors', () => {
      const { container } = render(<StyleAnalysisChart metadata={mockMetadata} />);

      const toneElement = container.querySelector('.bg-orange-100.text-orange-800');
      expect(toneElement).toBeInTheDocument();
    });

    it('should apply appropriate CSS classes for style colors', () => {
      const { container } = render(<StyleAnalysisChart metadata={mockMetadata} />);

      const styleElement = container.querySelector('.bg-green-100.text-green-800.border-green-200');
      expect(styleElement).toBeInTheDocument();
    });
  });
});