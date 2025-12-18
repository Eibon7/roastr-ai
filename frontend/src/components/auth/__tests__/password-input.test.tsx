import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '../password-input';

describe('PasswordInput', () => {
  it('renders password input field', () => {
    render(<PasswordInput id="password" />);

    const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('password');
  });

  it('toggles password visibility when eye button is clicked', async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="password" />);

    const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
    const toggleButton = screen.getByRole('button', { name: /show password/i });

    expect(input.type).toBe('password');

    await user.click(toggleButton);

    expect(input.type).toBe('text');
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('hides toggle button when showToggle is false', () => {
    render(<PasswordInput id="password" showToggle={false} />);

    const toggleButton = screen.queryByRole('button');
    expect(toggleButton).not.toBeInTheDocument();
  });

  it('forwards ref correctly', () => {
    const ref = vi.fn();
    render(<PasswordInput id="password" ref={ref} />);

    expect(ref).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(<PasswordInput id="password" className="custom-class" />);

    const input = screen.getByRole('textbox', { hidden: true });
    expect(input).toHaveClass('custom-class');
  });

  it('passes through input props', () => {
    render(<PasswordInput id="password" placeholder="Enter password" required />);

    const input = screen.getByPlaceholderText('Enter password') as HTMLInputElement;
    expect(input).toBeRequired();
  });
});

