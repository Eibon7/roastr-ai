/**
 * Tests for UsageWidgets Component - Issue #1044
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import UsageWidgets from '../usage-widgets';
import { apiClient } from '../../../../lib/api';

// Mock apiClient
jest.mock('../../../../lib/api', () => ({
  apiClient: {
    get: jest.fn()
  }
}));

describe('UsageWidgets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state initially', () => {
    apiClient.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<UsageWidgets />);

    // Skeleton doesn't have testid, check by class
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render usage widgets with data', async () => {
    // apiClient.get returns response object with .data property
    // Component expects: response.data = { success: true, data: {...} }
    // Then extracts: responseData.data = { analysis: {...}, roasts: {...} }
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          analysis: { used: 45, limit: 100 },
          roasts: { used: 12, limit: 50 }
        }
      }
    });

    render(<UsageWidgets />);

    await waitFor(() => {
      expect(screen.getByText('Análisis este mes')).toBeInTheDocument();
      expect(screen.getByText('Roasts este mes')).toBeInTheDocument();
    });

    // Numbers appear multiple times, verify they're present
    await waitFor(
      () => {
        // Check that numbers appear in the document (they may be in different elements)
        const pageText = document.body.textContent || '';
        expect(pageText).toContain('45');
        expect(pageText).toContain('100');
        expect(pageText).toContain('12');
        expect(pageText).toContain('50');
      },
      { timeout: 3000 }
    );
  });

  it('should calculate and display percentages correctly', async () => {
    const mockUsageData = {
      success: true,
      data: {
        analysis: { used: 75, limit: 100 },
        roasts: { used: 25, limit: 50 }
      }
    };

    apiClient.get.mockResolvedValue(mockUsageData);

    render(<UsageWidgets />);

    await waitFor(() => {
      // Percentages appear multiple times, use queryAllByText
      expect(screen.queryAllByText('75%').length).toBeGreaterThan(0);
      expect(screen.queryAllByText('50%').length).toBeGreaterThan(0);
    });
  });

  it('should handle error state', async () => {
    apiClient.get.mockRejectedValue(new Error('API Error'));

    render(<UsageWidgets />);

    await waitFor(() => {
      // Error appears in both widgets, use queryAllByText
      const errors = screen.queryAllByText(/Error/i);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('should handle unlimited limits (limit = -1)', async () => {
    const mockUsageData = {
      success: true,
      data: {
        analysis: { used: 1000, limit: -1 },
        roasts: { used: 500, limit: -1 }
      }
    };

    apiClient.get.mockResolvedValue(mockUsageData);

    render(<UsageWidgets />);

    await waitFor(() => {
      // Infinity symbol appears in text content, check by text content match
      const infinityElements = screen.queryAllByText((content, element) => {
        return element?.textContent?.includes('∞') || false;
      });
      expect(infinityElements.length).toBeGreaterThan(0);
    });
  });

  it('should use fallback data on error', async () => {
    apiClient.get.mockRejectedValue(new Error('Network error'));

    render(<UsageWidgets />);

    await waitFor(() => {
      // Should still render widgets with fallback data
      expect(screen.getByText('Análisis este mes')).toBeInTheDocument();
    });
  });

  it('should call correct API endpoint', async () => {
    const mockUsageData = {
      success: true,
      data: {
        analysis: { used: 0, limit: 100 },
        roasts: { used: 0, limit: 50 }
      }
    };
    apiClient.get.mockResolvedValue(mockUsageData);

    render(<UsageWidgets />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/usage/current');
    });
  });
});
