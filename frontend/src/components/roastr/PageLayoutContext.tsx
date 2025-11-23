import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  DependencyList
} from 'react';
import PageLayout, { PageLayoutProps, PageLayoutConfig, defaultPageLayout } from './PageLayout';

type PageLayoutContextValue = {
  layout: PageLayoutConfig;
  setLayout: (
    value: Partial<PageLayoutConfig> | ((prev: PageLayoutConfig) => PageLayoutConfig)
  ) => void;
  resetLayout: () => void;
};

const PageLayoutContext = createContext<PageLayoutContextValue | null>(null);

export function PageLayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayoutState] = useState<PageLayoutConfig>(defaultPageLayout);

  const setLayout = useCallback(
    (value: Partial<PageLayoutConfig> | ((prev: PageLayoutConfig) => PageLayoutConfig)) => {
      setLayoutState((prev) => {
        if (typeof value === 'function') {
          return value(prev);
        }

        return {
          ...prev,
          ...value
        };
      });
    },
    []
  );

  const resetLayout = useCallback(() => setLayoutState(defaultPageLayout), []);

  const contextValue = useMemo(
    () => ({
      layout,
      setLayout,
      resetLayout
    }),
    [layout, resetLayout, setLayout]
  );

  return <PageLayoutContext.Provider value={contextValue}>{children}</PageLayoutContext.Provider>;
}

export function usePageLayout() {
  const context = useContext(PageLayoutContext);
  if (!context) {
    throw new Error('usePageLayout debe usarse dentro de PageLayoutProvider');
  }

  return context;
}

export function PageLayoutContainer({ children }: { children: ReactNode }) {
  const { layout } = usePageLayout();
  return <PageLayout {...layout}>{children}</PageLayout>;
}

export function usePageLayoutConfig(config: Partial<PageLayoutConfig>, deps: DependencyList = []) {
  const { setLayout, resetLayout } = usePageLayout();

  useEffect(() => {
    setLayout(config);
    return () => resetLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setLayout, resetLayout, ...deps]);
}
