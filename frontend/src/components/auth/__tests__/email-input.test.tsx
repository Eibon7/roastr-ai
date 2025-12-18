import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmailInput } from '../email-input';

describe('EmailInput', () => {
  it('renders email input field', () => {
    render(<EmailInput id="email" />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('email');
  });

  it('has email autocomplete attribute', () => {
    render(<EmailInput id="email" />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toHaveAttribute('autocomplete', 'email');
  });

  it('shows error state when hasError is true', () => {
    render(<EmailInput id="email" hasError />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('border-destructive');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not show error state when hasError is false', () => {
    render(<EmailInput id="email" hasError={false} />);

    const input = screen.getByRole('textbox');
    expect(input).not.toHaveClass('border-destructive');
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('does not set aria-invalid when hasError is undefined', () => {
    render(<EmailInput id="email" />);

    const input = screen.getByRole('textbox');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('forwards ref correctly', () => {
    const ref = vi.fn();
    render(<EmailInput id="email" ref={ref} />);

    expect(ref).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<EmailInput id="email" className="custom-class" />);

    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-class');
  });

  it('passes through input props', () => {
    render(<EmailInput id="email" placeholder="Enter email" required />);

    const input = screen.getByPlaceholderText('Enter email') as HTMLInputElement;
    expect(input).toBeRequired();
  });
});

