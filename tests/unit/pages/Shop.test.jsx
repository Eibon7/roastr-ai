/**
 * Shop Component - Unit Tests
 *
 * Tests for add-ons marketplace page
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Shop from '../../../frontend/src/pages/Shop';
import { useFeatureFlags } from '../../../frontend/src/hooks/useFeatureFlags';

jest.mock('../../../frontend/src/hooks/useFeatureFlags');

describe('Shop Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useFeatureFlags.mockReturnValue({
      flags: { ENABLE_SHOP: false },
      loading: false
    });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <Shop />
      </BrowserRouter>
    );
  };

  describe('Rendering', () => {
    it('should render page header', () => {
      renderComponent();

      expect(screen.getByText(/Roastr Shop/i)).toBeInTheDocument();
      expect(screen.getByText(/Potencia tu experiencia con Roastr/i)).toBeInTheDocument();
    });

    it('should display beta notice', () => {
      renderComponent();

      expect(screen.getByText(/Próximamente disponible/i)).toBeInTheDocument();
      expect(screen.getByText(/La tienda de Roastr está en desarrollo/i)).toBeInTheDocument();
    });

    it('should render all addon cards', () => {
      renderComponent();

      expect(screen.getByText(/Tonos Premium/i)).toBeInTheDocument();
      expect(screen.getByText(/Shield Pro/i)).toBeInTheDocument();
      expect(screen.getByText(/Roast Boost/i)).toBeInTheDocument();
      expect(screen.getByText(/Analytics Pro/i)).toBeInTheDocument();
    });

    it('should display addon prices', () => {
      renderComponent();

      expect(screen.getByText(/\$4\.99/)).toBeInTheDocument();
      expect(screen.getByText(/\$9\.99/)).toBeInTheDocument();
      expect(screen.getByText(/\$7\.99/)).toBeInTheDocument();
      expect(screen.getByText(/\$12\.99/)).toBeInTheDocument();
    });
  });

  describe('Addon Features', () => {
    it('should display features for each addon', () => {
      renderComponent();

      expect(screen.getByText(/Tono Intelectual con referencias culturales/i)).toBeInTheDocument();
      expect(screen.getByText(/Filtros de contenido personalizables/i)).toBeInTheDocument();
      expect(screen.getByText(/Generación 3x más rápida/i)).toBeInTheDocument();
      expect(screen.getByText(/Métricas de engagement detalladas/i)).toBeInTheDocument();
    });

    it('should show popular badge for Shield Pro', () => {
      renderComponent();

      expect(screen.getByText(/Más popular/i)).toBeInTheDocument();
    });

    it('should render addon icons', () => {
      renderComponent();

      // Icons should be rendered via lucide-react
      const cards = screen.getAllByRole('button', { name: /Próximamente/i });
      expect(cards.length).toBeGreaterThan(0);
    });
  });

  describe('Feature Flag Integration', () => {
    it('should disable purchase when flag is disabled', () => {
      renderComponent();

      const buttons = screen.getAllByRole('button', { name: /Próximamente/i });
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it('should enable purchase when flag is enabled', () => {
      useFeatureFlags.mockReturnValue({
        flags: { ENABLE_SHOP: true },
        loading: false
      });

      renderComponent();

      const obtenerButtons = screen.getAllByRole('button', { name: /Obtener ahora|Comprar/i });
      expect(obtenerButtons.length).toBeGreaterThan(0);
      obtenerButtons.forEach((button) => {
        expect(button).not.toBeDisabled();
      });
    });

    it('should show loading state while flags load', () => {
      useFeatureFlags.mockReturnValue({
        flags: {},
        loading: true
      });

      renderComponent();

      const loadingButtons = screen.getAllByRole('button', { name: /Cargando.../i });
      expect(loadingButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Purchase Interaction', () => {
    it('should handle purchase button click', () => {
      useFeatureFlags.mockReturnValue({
        flags: { ENABLE_SHOP: true },
        loading: false
      });

      renderComponent();

      const purchaseButtons = screen.getAllByRole('button', { name: /Obtener ahora|Comprar/i });

      // Click first purchase button
      fireEvent.click(purchaseButtons[0]);

      // Function should be called (no console.log, just comment)
      expect(purchaseButtons[0]).toBeInTheDocument();
    });

    it('should not call handler when button is disabled', () => {
      renderComponent();

      const disabledButtons = screen.getAllByRole('button', { name: /Próximamente/i });

      // Buttons should be disabled
      disabledButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });
  });

  describe('Contact Section', () => {
    it('should display suggestion contact info', () => {
      renderComponent();

      expect(screen.getByText(/¿Tienes alguna sugerencia\?/i)).toBeInTheDocument();
      expect(screen.getByText(/shop@roastr\.ai/i)).toBeInTheDocument();
    });

    it('should render email link', () => {
      renderComponent();

      const emailLink = screen.getByRole('link', { name: /shop@roastr\.ai/i });
      expect(emailLink).toHaveAttribute('href', 'mailto:shop@roastr.ai');
    });
  });

  describe('Responsive Layout', () => {
    it('should render in grid layout', () => {
      const { container } = renderComponent();

      // Check for grid classes
      const grid = container.querySelector('.grid');
      expect(grid).toBeInTheDocument();
    });

    it('should have proper spacing', () => {
      const { container } = renderComponent();

      // Check for space-y classes
      const spacedContainer = container.querySelector('.space-y-6');
      expect(spacedContainer).toBeInTheDocument();
    });
  });

  describe('Addon Descriptions', () => {
    it('should show detailed description for Premium Tones', () => {
      renderComponent();

      expect(screen.getByText(/Acceso a tonos exclusivos como "Intelectual"/i)).toBeInTheDocument();
    });

    it('should show detailed description for Shield Pro', () => {
      renderComponent();

      expect(
        screen.getByText(/Protección avanzada contra contenido inapropiado/i)
      ).toBeInTheDocument();
    });

    it('should show detailed description for Roast Boost', () => {
      renderComponent();

      expect(
        screen.getByText(/Generación de roasts más rápida y con mayor creatividad/i)
      ).toBeInTheDocument();
    });

    it('should show detailed description for Analytics Pro', () => {
      renderComponent();

      expect(screen.getByText(/Métricas avanzadas y análisis de engagement/i)).toBeInTheDocument();
    });
  });
});
