import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ConfirmDialog from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any body style changes
    document.body.style.overflow = 'unset';
  });

  it('should not render when open is false', () => {
    render(
      <ConfirmDialog
        open={false}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render with default props when open is true', () => {
    render(
      <ConfirmDialog
        open={true}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should render with custom props', () => {
    render(
      <ConfirmDialog
        open={true}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        title="Delete Profile"
        message="This action cannot be undone"
        confirmText="Delete"
        cancelText="Keep"
        variant="danger"
      />
    );

    expect(screen.getByText('Delete Profile')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Keep')).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', () => {
    render(
      <ConfirmDialog
        open={true}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText('Confirm'));
    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <ConfirmDialog
        open={true}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when X button is clicked', () => {
    render(
      <ConfirmDialog
        open={true}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    // Find the X button by its parent container and SVG
    const buttons = screen.getAllByRole('button');
    const closeButton = buttons.find(button => {
      const svg = button.querySelector('svg');
      return button.className.includes('h-6 w-6 p-0') && svg;
    });
    
    expect(closeButton).toBeInTheDocument();
    fireEvent.click(closeButton);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when backdrop is clicked', () => {
    render(
      <ConfirmDialog
        open={true}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    // Click on the backdrop (the overlay)
    const backdrop = document.querySelector('.fixed.inset-0');
    fireEvent.click(backdrop);
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel when Escape key is pressed', () => {
    render(
      <ConfirmDialog
        open={true}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should show danger styling with variant="danger"', () => {
    render(
      <ConfirmDialog
        open={true}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        variant="danger"
        title="Delete Profile"
      />
    );

    // Check for danger variant classes (text-red-900 on title)
    const title = screen.getByText('Delete Profile');
    expect(title).toHaveClass('text-red-900');
  });

  it('should prevent body scroll when open', () => {
    render(
      <ConfirmDialog
        open={true}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should restore body scroll when closed', () => {
    const { rerender } = render(
      <ConfirmDialog
        open={true}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <ConfirmDialog
        open={false}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(document.body.style.overflow).toBe('unset');
  });
});