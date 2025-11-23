import React from 'react';
import { render, screen } from '@testing-library/react';
import Dashboard from '../dashboard';

// Mock lucide-react icons
jest.mock('lucide-react', () => {
  const MockIcon = (props) => <div data-testid="mock-icon" {...props} />;
  return new Proxy({}, { get: () => MockIcon });
});

// Mock all widgets
jest.mock('../../components/widgets', () => ({
  WIDGETS: {
    planStatus: () => <div data-testid="plan-status-widget">Plan Status Widget</div>,
    integrations: () => <div data-testid="integrations-widget">Integrations Widget</div>,
    health: () => <div data-testid="health-widget">Health Widget</div>,
    activity: () => <div data-testid="activity-widget">Activity Widget</div>,
    queue: () => <div data-testid="queue-widget">Queue Widget</div>,
    costs: () => <div data-testid="costs-widget">Costs Widget</div>,
    logs: () => <div data-testid="logs-widget">Logs Widget</div>
  },
  DEFAULT_LAYOUT: ['planStatus', 'integrations', 'health', 'activity', 'queue', 'costs', 'logs'],
  WIDGET_CONFIGS: {
    planStatus: {
      title: 'Plan Status',
      description: 'Current subscription & limits',
      gridCols: 'md:col-span-1'
    },
    integrations: {
      title: 'Integrations',
      description: 'Platform connections',
      gridCols: 'md:col-span-1'
    },
    health: {
      title: 'System Health',
      description: 'Service & feature flags',
      gridCols: 'md:col-span-1'
    },
    activity: {
      title: 'Recent Activity',
      description: 'Latest system events',
      gridCols: 'md:col-span-2'
    },
    queue: {
      title: 'Jobs Queue',
      description: 'Background processing',
      gridCols: 'md:col-span-1'
    },
    costs: {
      title: 'Usage & Costs',
      description: 'API calls & billing',
      gridCols: 'md:col-span-2'
    },
    logs: {
      title: 'System Logs',
      description: 'Error & info messages',
      gridCols: 'md:col-span-3'
    }
  }
}));

describe('Dashboard', () => {
  test('renders dashboard header', () => {
    render(<Dashboard />);

    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
    expect(
      screen.getByText('Monitor your roast bot performance and system health')
    ).toBeInTheDocument();
  });

  test('renders all 7 widgets', () => {
    render(<Dashboard />);

    expect(screen.getByTestId('plan-status-widget')).toBeInTheDocument();
    expect(screen.getByTestId('integrations-widget')).toBeInTheDocument();
    expect(screen.getByTestId('health-widget')).toBeInTheDocument();
    expect(screen.getByTestId('activity-widget')).toBeInTheDocument();
    expect(screen.getByTestId('queue-widget')).toBeInTheDocument();
    expect(screen.getByTestId('costs-widget')).toBeInTheDocument();
    expect(screen.getByTestId('logs-widget')).toBeInTheDocument();
  });

  test('widgets are rendered in correct order', () => {
    render(<Dashboard />);

    const widgets = screen.getAllByTestId(/-widget$/);
    const expectedOrder = [
      'plan-status-widget',
      'integrations-widget',
      'health-widget',
      'activity-widget',
      'queue-widget',
      'costs-widget',
      'logs-widget'
    ];

    widgets.forEach((widget, index) => {
      expect(widget).toHaveAttribute('data-testid', expectedOrder[index]);
    });
  });

  test('applies correct grid classes to widgets', () => {
    render(<Dashboard />);

    // Check that widgets are within containers with appropriate grid classes
    const planStatusWidget = screen.getByText('Plan Status Widget');
    const planContainer = planStatusWidget.closest('div[class*="col-span"]');
    expect(planContainer).toHaveClass('md:col-span-1');

    const logsWidget = screen.getByText('Logs Widget');
    const logsContainer = logsWidget.closest('div[class*="col-span"]');
    expect(logsContainer).toHaveClass('md:col-span-3');
  });

  test('handles missing widgets gracefully', () => {
    // Console spy to check for warning
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Mock widgets with missing widget
    jest.doMock('../../components/widgets', () => ({
      WIDGETS: {
        planStatus: () => <div>Plan Status Widget</div>
        // Missing other widgets
      },
      DEFAULT_LAYOUT: ['planStatus', 'missingWidget'],
      WIDGET_CONFIGS: {
        planStatus: { gridCols: 'md:col-span-1' },
        missingWidget: { gridCols: 'md:col-span-1' }
      }
    }));

    render(<Dashboard />);

    // The Dashboard should still render without crashing
    expect(screen.getByText('Plan Status Widget')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  test('dashboard has proper semantic structure', () => {
    render(<Dashboard />);

    // Check for proper heading hierarchy
    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toHaveTextContent('Dashboard');

    // Check for main content structure
    const gridContainer = document.querySelector('.grid');
    expect(gridContainer).toHaveClass('grid-cols-1', 'md:grid-cols-3', 'gap-4');
  });
});
