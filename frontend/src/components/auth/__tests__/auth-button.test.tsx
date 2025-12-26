import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthButton } from '../auth-button';

describe('AuthButton', () => {
  it('renders button with children', () => {
    render(<AuthButton>Click me</AuthButton>);

    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('shows loading state with spinner', () => {
    render(<AuthButton loading>Submit</AuthButton>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('shows custom loading text', () => {
    render(<AuthButton loading loadingText="Iniciando sesión...">Submit</AuthButton>);

    expect(screen.getByText('Iniciando sesión...')).toBeInTheDocument();
  });

  it('is disabled when loading', () => {
    render(<AuthButton loading>Submit</AuthButton>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('is disabled when disabled prop is true', () => {
    render(<AuthButton disabled>Submit</AuthButton>);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('has full width by default', () => {
    render(<AuthButton>Submit</AuthButton>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('w-full');
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    render(<AuthButton onClick={handleClick}>Submit</AuthButton>);

    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('forwards ref correctly', () => {
    const ref = vi.fn();
    render(<AuthButton ref={ref}>Submit</AuthButton>);

    expect(ref).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<AuthButton className="custom-class">Submit</AuthButton>);

    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });
});


