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

    expect(screen.getAllByTestId(/skeleton/i).length).toBeGreaterThan(0);
  });

  it('should render usage widgets with data', async () => {
    const mockUsageData = {
      analysis: { used: 45, limit: 100 },
      roasts: { used: 12, limit: 50 }
    };

    apiClient.get.mockResolvedValue({ data: mockUsageData });

    render(<UsageWidgets />);

    await waitFor(() => {
      expect(screen.getByText('Análisis este mes')).toBeInTheDocument();
      expect(screen.getByText('Roasts este mes')).toBeInTheDocument();
    });

    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should calculate and display percentages correctly', async () => {
    const mockUsageData = {
      analysis: { used: 75, limit: 100 },
      roasts: { used: 25, limit: 50 }
    };

    apiClient.get.mockResolvedValue({ data: mockUsageData });

    render(<UsageWidgets />);

    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  it('should handle error state', async () => {
    apiClient.get.mockRejectedValue(new Error('API Error'));

    render(<UsageWidgets />);

    await waitFor(() => {
      expect(screen.getByText(/Error/i)).toBeInTheDocument();
    });
  });

  it('should handle unlimited limits (limit = -1)', async () => {
    const mockUsageData = {
      analysis: { used: 1000, limit: -1 },
      roasts: { used: 500, limit: -1 }
    };

    apiClient.get.mockResolvedValue({ data: mockUsageData });

    render(<UsageWidgets />);

    await waitFor(() => {
      expect(screen.getByText('∞')).toBeInTheDocument();
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
    apiClient.get.mockResolvedValue({
      data: { analysis: { used: 0, limit: 100 }, roasts: { used: 0, limit: 50 } }
    });

    render(<UsageWidgets />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/usage/current');
    });
  });
});
