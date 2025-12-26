import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MagicLinkForm } from '../magic-link-form';

describe('MagicLinkForm', () => {
  const defaultProps = {
    email: '',
    onEmailChange: vi.fn(),
    onSubmit: vi.fn((e) => e.preventDefault())
  };

  it('renders email input field', () => {
    render(<MagicLinkForm {...defaultProps} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('email');
  });

  it('displays email value', () => {
    render(<MagicLinkForm {...defaultProps} email="test@example.com" />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('test@example.com');
  });

  it('calls onEmailChange when email input changes', async () => {
    const onEmailChange = vi.fn();
    const user = userEvent.setup();
    render(<MagicLinkForm {...defaultProps} onEmailChange={onEmailChange} />);

    const input = screen.getByRole('textbox');
    await user.type(input, 'test@example.com');

    expect(onEmailChange).toHaveBeenCalled();
  });

  it('displays error message when error prop is provided', () => {
    render(<MagicLinkForm {...defaultProps} error="Email is required" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<MagicLinkForm {...defaultProps} loading />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(screen.getByText('Enviando...')).toBeInTheDocument();
  });

  it('calls onSubmit when form is submitted', async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    const user = userEvent.setup();
    render(<MagicLinkForm {...defaultProps} onSubmit={onSubmit} email="test@example.com" />);

    await user.click(screen.getByRole('button'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('displays success message when successMessage is provided', () => {
    render(
      <MagicLinkForm
        {...defaultProps}
        successMessage="Si existe una cuenta, recibirás un enlace para restablecer tu contraseña."
      />
    );

    expect(
      screen.getByText(/si existe una cuenta, recibirás un enlace/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('uses custom labels and placeholders', () => {
    render(
      <MagicLinkForm
        {...defaultProps}
        emailLabel="Correo electrónico"
        emailPlaceholder="ingresa@tuemail.com"
        buttonText="Enviar"
      />
    );

    expect(screen.getByText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ingresa@tuemail.com')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveTextContent('Enviar');
  });

  it('forwards ref correctly', () => {
    const ref = vi.fn();
    render(<MagicLinkForm {...defaultProps} ref={ref} />);

    expect(ref).toHaveBeenCalled();
  });
});


