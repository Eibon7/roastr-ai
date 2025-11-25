/**
 * Comprehensive tests for Issue #366 - Dashboard Metrics UI Implementation
 * Tests the metrics cards and Shield UI section in the dashboard
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the hooks and components
const mockAnalyticsData = {
  totalAnalyses: 150,
  totalRoasts: 89,
  last30DaysAnalyses: 45,
  last30DaysRoasts: 23
};

const mockShieldData = [
  {
    id: '1',
    comment: 'Test intercepted comment',
    platform: 'twitter',
    timestamp: '2024-01-15T10:30:00Z',
    action: 'blocked'
  },
  {
    id: '2',
    comment: 'Another test comment',
    platform: 'instagram',
    timestamp: '2024-01-14T15:45:00Z',
    action: 'warned'
  }
];

const mockUseFeatureFlags = jest.fn();

// Mock apiClient instead of non-existent hooks
const mockApiClient = {
  get: jest.fn(),
  post: jest.fn()
};

jest.mock('../../../frontend/src/lib/api', () => ({
  apiClient: mockApiClient
}));

jest.mock('../../../frontend/src/hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => mockUseFeatureFlags()
}));

// Mock Material-UI components
jest.mock('@mui/material', () => ({
  Card: ({ children, ...props }) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
  Typography: ({ children, variant, ...props }) => (
    <div data-testid={`typography-${variant}`} {...props}>
      {children}
    </div>
  ),
  Box: ({ children, ...props }) => (
    <div data-testid="box" {...props}>
      {children}
    </div>
  ),
  CircularProgress: () => <div data-testid="loading">Loading...</div>,
  Collapse: ({ children, in: isOpen, ...props }) =>
    isOpen ? (
      <div data-testid="collapse" {...props}>
        {children}
      </div>
    ) : null,
  IconButton: ({ children, onClick, ...props }) => (
    <button data-testid="icon-button" onClick={onClick} {...props}>
      {children}
    </button>
  )
}));

jest.mock('@mui/icons-material', () => ({
  ExpandMore: () => <span data-testid="expand-more-icon">▼</span>,
  ExpandLess: () => <span data-testid="expand-less-icon">▲</span>,
  Analytics: () => <span data-testid="analytics-icon">📊</span>,
  Shield: () => <span data-testid="shield-icon">🛡️</span>
}));

describe('Issue #366 - Dashboard Metrics UI', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations for apiClient
    mockApiClient.get.mockImplementation((url) => {
      if (url === '/analytics/summary') {
        return Promise.resolve({ data: mockAnalyticsData });
      }
      if (url === '/shield/intercepted') {
        return Promise.resolve({ data: mockShieldData });
      }
      return Promise.resolve({ data: {} });
    });

    mockUseFeatureFlags.mockReturnValue({
      flags: {
        ENABLE_SHIELD_UI: true
      },
      isEnabled: jest.fn((flag) => flag === 'ENABLE_SHIELD_UI')
    });
  });

  describe('Analytics Metrics Cards', () => {
    it('should render analytics metrics cards with correct data', async () => {
      const { default: Dashboard } = require('../../../frontend/src/pages/dashboard');

      render(<Dashboard />);

      // Check for analytics metrics
      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument(); // totalAnalyses
        expect(screen.getByText('89')).toBeInTheDocument(); // totalRoasts
        expect(screen.getByText('45')).toBeInTheDocument(); // last30DaysAnalyses
        expect(screen.getByText('23')).toBeInTheDocument(); // last30DaysRoasts
      });

      // Check for proper labels
      expect(screen.getByText(/análisis completados/i)).toBeInTheDocument();
      expect(screen.getByText(/roasts enviados/i)).toBeInTheDocument();
      expect(screen.getByText(/últimos 30 días/i)).toBeInTheDocument();
    });

    it('should show loading state for analytics', async () => {
      // Mock delayed response to simulate loading
      mockApiClient.get.mockImplementation((url) => {
        if (url === '/analytics/summary') {
          return new Promise(() => {}); // Never resolves to simulate loading
        }
        return Promise.resolve({ data: {} });
      });

      const { default: Dashboard } = require('../../../frontend/src/pages/dashboard');

      render(<Dashboard />);

      // Check for loading skeletons
      await waitFor(() => {
        const skeletons = screen.queryAllByTestId('skeleton');
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });

    it('should handle analytics error state', async () => {
      mockApiClient.get.mockImplementation((url) => {
        if (url === '/analytics/summary') {
          return Promise.reject(new Error('Failed to load analytics'));
        }
        return Promise.resolve({ data: {} });
      });

      const { default: Dashboard } = require('../../../frontend/src/pages/dashboard');

      render(<Dashboard />);

      // Dashboard should still render even if analytics fails
      await waitFor(() => {
        expect(screen.queryByText(/error cargando métricas/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Shield UI Section', () => {
    it('should render collapsible Shield section when feature flag enabled', async () => {
      const { default: Dashboard } = require('../../../frontend/src/pages/dashboard');

      render(<Dashboard />);

      // Check for Shield section
      expect(screen.getByText(/contenido interceptado/i)).toBeInTheDocument();
      expect(screen.getByTestId('shield-icon')).toBeInTheDocument();

      // Should be collapsed by default
      expect(screen.queryByTestId('collapse')).not.toBeInTheDocument();
    });

    it('should expand/collapse Shield section when clicked', async () => {
      const { default: Dashboard } = require('../../../frontend/src/pages/dashboard');

      render(<Dashboard />);

      const expandButton = screen.getByTestId('icon-button');

      // Initially collapsed
      expect(screen.queryByTestId('collapse')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(expandButton);
      await waitFor(() => {
        expect(screen.getByTestId('collapse')).toBeInTheDocument();
      });

      // Should show intercepted items
      expect(screen.getByText('Test intercepted comment')).toBeInTheDocument();
      expect(screen.getByText('Another test comment')).toBeInTheDocument();
    });

    it('should not render Shield section when feature flag disabled', () => {
      mockUseFeatureFlags.mockReturnValue({
        flags: {
          ENABLE_SHIELD_UI: false
        },
        isEnabled: jest.fn(() => false)
      });

      const { default: Dashboard } = require('../../../frontend/src/pages/dashboard');

      render(<Dashboard />);

      expect(screen.queryByText(/contenido interceptado/i)).not.toBeInTheDocument();
    });

    it('should show empty state when no intercepted items', async () => {
      mockApiClient.get.mockImplementation((url) => {
        if (url === '/shield/intercepted') {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: {} });
      });

      const { default: Dashboard } = require('../../../frontend/src/pages/dashboard');

      render(<Dashboard />);

      // Expand Shield section
      const expandButton = screen.getByTestId('icon-button');
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByText(/no hay contenido interceptado/i)).toBeInTheDocument();
      });
    });

    it('should handle Shield data loading state', async () => {
      // Mock delayed response to simulate loading
      mockApiClient.get.mockImplementation((url) => {
        if (url === '/shield/intercepted') {
          return new Promise(() => {}); // Never resolves to simulate loading
        }
        return Promise.resolve({ data: {} });
      });

      const { default: Dashboard } = require('../../../frontend/src/pages/dashboard');

      render(<Dashboard />);

      // Expand Shield section
      const expandButton = screen.getByTestId('icon-button');
      fireEvent.click(expandButton);

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adjust grid layout for different screen sizes', () => {
      const { default: Dashboard } = require('../../../frontend/src/pages/dashboard');

      const { container } = render(<Dashboard />);

      // Check for responsive grid classes
      const gridElements = container.querySelectorAll('[class*="grid"]');
      expect(gridElements.length).toBeGreaterThan(0);

      // Should contain responsive classes like md:grid-cols-2, lg:grid-cols-4
      const hasResponsiveClasses = Array.from(gridElements).some(
        (el) => el.className.includes('md:') || el.className.includes('lg:')
      );
      expect(hasResponsiveClasses).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels for Shield section', () => {
      const { default: Dashboard } = require('../../../frontend/src/pages/dashboard');

      render(<Dashboard />);

      const expandButton = screen.getByTestId('icon-button');
      expect(expandButton).toHaveAttribute('aria-label');
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      // Click to expand
      fireEvent.click(expandButton);
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('should have semantic structure for metrics cards', () => {
      const { default: Dashboard } = require('../../../frontend/src/pages/dashboard');

      render(<Dashboard />);

      // Check for heading structure
      expect(screen.getByRole('main') || screen.getByTestId('dashboard-main')).toBeInTheDocument();

      // Check for card structure
      const cards = screen.getAllByTestId('card');
      expect(cards.length).toBeGreaterThanOrEqual(4); // At least 4 metric cards
    });
  });
});
