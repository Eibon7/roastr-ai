import { render, screen, renderHook } from '@testing-library/react';
import { act } from 'react';
import {
  PageLayoutProvider,
  usePageLayout,
  usePageLayoutConfig,
  PageLayoutContainer
} from '../../../components/roastr/PageLayoutContext';

describe('PageLayoutContext', () => {
  describe('PageLayoutProvider', () => {
    it('provides layout context to children', () => {
      const TestComponent = () => {
        const { layout } = usePageLayout();
        return <div>{layout.title}</div>;
      };

      render(
        <PageLayoutProvider>
          <TestComponent />
        </PageLayoutProvider>
      );

      expect(screen.getByText('Panel de control')).toBeInTheDocument();
    });
  });

  describe('usePageLayout', () => {
    it('throws error when used outside PageLayoutProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => renderHook(() => usePageLayout())).toThrow(
        'usePageLayout debe usarse dentro de PageLayoutProvider'
      );

      consoleSpy.mockRestore();
    });

    it('allows updating layout', () => {
      const { result } = renderHook(() => usePageLayout(), {
        wrapper: PageLayoutProvider
      });

      act(() => {
        result.current.setLayout({ title: 'New Title' });
      });

      expect(result.current.layout.title).toBe('New Title');
    });

    it('allows resetting layout', () => {
      const { result } = renderHook(() => usePageLayout(), {
        wrapper: PageLayoutProvider
      });

      act(() => {
        result.current.setLayout({ title: 'Custom Title' });
      });

      expect(result.current.layout.title).toBe('Custom Title');

      act(() => {
        result.current.resetLayout();
      });

      expect(result.current.layout.title).toBe('Panel de control');
    });

    it('supports function updater', () => {
      const { result } = renderHook(() => usePageLayout(), {
        wrapper: PageLayoutProvider
      });

      act(() => {
        result.current.setLayout((prev) => ({
          ...prev,
          title: `${prev.title} - Updated`
        }));
      });

      expect(result.current.layout.title).toBe('Panel de control - Updated');
    });
  });

  describe('PageLayoutContainer', () => {
    it('renders PageLayout with context values', () => {
      render(
        <PageLayoutProvider>
          <PageLayoutContainer>
            <div>Test Content</div>
          </PageLayoutContainer>
        </PageLayoutProvider>
      );

      expect(screen.getByText('Panel de control')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });
  });

  describe('usePageLayoutConfig', () => {
    it('updates layout on mount', () => {
      const TestComponent = () => {
        usePageLayoutConfig({ title: 'Test Title', subtitle: 'Test Subtitle' });
        const { layout } = usePageLayout();
        return <div>{layout.title}</div>;
      };

      render(
        <PageLayoutProvider>
          <TestComponent />
        </PageLayoutProvider>
      );

      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('resets layout on unmount', () => {
      const TestComponent = ({ show }: { show: boolean }) => {
        const { layout } = usePageLayout();

        if (show) {
          return <ChildWithConfig />;
        }

        return <div>{layout.title}</div>;
      };

      const ChildWithConfig = () => {
        usePageLayoutConfig({ title: 'Temporary Title' });
        return null;
      };

      const { rerender } = render(
        <PageLayoutProvider>
          <TestComponent show={true} />
        </PageLayoutProvider>
      );

      // Unmount child component
      rerender(
        <PageLayoutProvider>
          <TestComponent show={false} />
        </PageLayoutProvider>
      );

      // Should reset to default
      expect(screen.getByText('Panel de control')).toBeInTheDocument();
    });
  });
});
