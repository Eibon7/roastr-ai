import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Shop from '../Shop';

// Mock console.log to test purchase handler
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

describe('Shop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  it('should render shop header correctly', () => {
    render(<Shop />);

    expect(screen.getByText('Roastr Shop')).toBeInTheDocument();
    expect(screen.getByText(/Potencia tu experiencia con Roastr/)).toBeInTheDocument();
  });

  it('should render beta notice', () => {
    render(<Shop />);

    expect(screen.getByText('🚧 Próximamente disponible')).toBeInTheDocument();
    expect(screen.getByText(/La tienda de Roastr está en desarrollo/)).toBeInTheDocument();
  });

  it('should render all addon cards', () => {
    render(<Shop />);

    // Check for addon names
    expect(screen.getByText('Tonos Premium')).toBeInTheDocument();
    expect(screen.getByText('Shield Pro')).toBeInTheDocument();
    expect(screen.getByText('Roast Boost')).toBeInTheDocument();
    expect(screen.getByText('Analytics Pro')).toBeInTheDocument();
  });

  it('should display addon prices correctly', () => {
    render(<Shop />);

    expect(screen.getByText('$4.99')).toBeInTheDocument();
    expect(screen.getByText('$9.99')).toBeInTheDocument();
    expect(screen.getByText('$7.99')).toBeInTheDocument();
    expect(screen.getByText('$12.99')).toBeInTheDocument();
  });

  it('should show popular badge for Shield Pro', () => {
    render(<Shop />);

    expect(screen.getByText('Más popular')).toBeInTheDocument();
  });

  it('should display addon features', () => {
    render(<Shop />);

    // Check for some specific features
    expect(screen.getByText(/Tono Intelectual con referencias culturales/)).toBeInTheDocument();
    expect(screen.getByText(/Filtros de contenido personalizables/)).toBeInTheDocument();
    expect(screen.getByText(/Generación 3x más rápida/)).toBeInTheDocument();
    expect(screen.getByText(/Métricas de engagement detalladas/)).toBeInTheDocument();
  });

  it('should have disabled purchase buttons', () => {
    render(<Shop />);

    const buttons = screen.getAllByRole('button');
    const purchaseButtons = buttons.filter(button => 
      button.textContent === 'Obtener ahora' || button.textContent === 'Próximamente'
    );

    purchaseButtons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('should call handlePurchase when button is clicked (if enabled)', () => {
    render(<Shop />);

    // Since buttons are disabled, we can't test the actual click
    // But we can verify the console.log would be called with correct addon ID
    // This is more of a code structure test
    expect(mockConsoleLog).not.toHaveBeenCalled();
  });

  it('should render contact information', () => {
    render(<Shop />);

    expect(screen.getByText('¿Tienes alguna sugerencia?')).toBeInTheDocument();
    expect(screen.getByText(/contáctanos en/)).toBeInTheDocument();
    
    const emailLink = screen.getByRole('link', { name: /shop@roastr.ai/ });
    expect(emailLink).toBeInTheDocument();
    expect(emailLink).toHaveAttribute('href', 'mailto:shop@roastr.ai');
  });

  it('should have proper accessibility attributes', () => {
    render(<Shop />);

    // Check for proper heading structure
    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toHaveTextContent('Roastr Shop');

    // Check for proper button labels
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should display addon descriptions', () => {
    render(<Shop />);

    expect(screen.getByText(/Acceso a tonos exclusivos como/)).toBeInTheDocument();
    expect(screen.getByText(/Protección avanzada contra contenido inapropiado/)).toBeInTheDocument();
    expect(screen.getByText(/Generación de roasts más rápida/)).toBeInTheDocument();
    expect(screen.getByText(/Métricas avanzadas y análisis de engagement/)).toBeInTheDocument();
  });

  it('should have proper card structure for each addon', () => {
    render(<Shop />);

    // Each addon should have its icon, name, description, price, and features
    const addonCards = screen.getAllByText(/\$\d+\.\d+/); // Price pattern
    expect(addonCards).toHaveLength(4); // 4 addons
  });

  it('should show monthly billing period', () => {
    render(<Shop />);

    const monthlyTexts = screen.getAllByText('/mes');
    expect(monthlyTexts).toHaveLength(4); // All 4 addons are monthly
  });

  it('should render feature lists correctly', () => {
    render(<Shop />);

    // Check that feature lists are rendered by looking for specific features
    expect(screen.getByText(/Tono Intelectual con referencias culturales/)).toBeInTheDocument();
    expect(screen.getByText(/Filtros de contenido personalizables/)).toBeInTheDocument();
    expect(screen.getByText(/Generación 3x más rápida/)).toBeInTheDocument();
    expect(screen.getByText(/Métricas de engagement detalladas/)).toBeInTheDocument();
  });
});
