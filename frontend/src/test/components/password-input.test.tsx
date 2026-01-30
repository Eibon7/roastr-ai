import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '@/components/ui/password-input';

describe('PasswordInput', () => {
  describe('Rendering', () => {
    it('renders password input with toggle button', () => {
      render(<PasswordInput data-testid="password-input" />);

      const input = screen.getByTestId('password-input');
      expect(input).toHaveAttribute('type', 'password');
      
      const toggleButton = screen.getByRole('button');
      expect(toggleButton).toBeInTheDocument();
    });

    it('has proper aria-label for toggle button', () => {
      render(<PasswordInput />);

      const toggleButton = screen.getByRole('button', { name: /mostrar contraseña/i });
      expect(toggleButton).toBeInTheDocument();
    });

    it('accepts custom toggle aria-label', () => {
      render(<PasswordInput toggleAriaLabel="Show password" />);

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      expect(toggleButton).toBeInTheDocument();
    });
  });

  describe('Toggle Functionality', () => {
    it('toggles password visibility on button click', async () => {
      const user = userEvent.setup();
      render(<PasswordInput data-testid="password-input" />);

      const input = screen.getByTestId('password-input');
      const toggleButton = screen.getByRole('button');

      // Initially password type
      expect(input).toHaveAttribute('type', 'password');
      expect(toggleButton).toHaveAttribute('aria-label', 'Mostrar contraseña');

      // Click to show
      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'text');
      expect(toggleButton).toHaveAttribute('aria-label', 'Ocultar contraseña');

      // Click to hide
      await user.click(toggleButton);
      expect(input).toHaveAttribute('type', 'password');
      expect(toggleButton).toHaveAttribute('aria-label', 'Mostrar contraseña');
    });

    it('aria-label switches between Mostrar and Ocultar', async () => {
      const user = userEvent.setup();
      render(<PasswordInput />);

      const toggleButton = screen.getByRole('button');

      // Initially: Mostrar
      expect(toggleButton).toHaveAttribute('aria-label', 'Mostrar contraseña');

      // After click: Ocultar
      await user.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-label', 'Ocultar contraseña');

      // After second click: Mostrar
      await user.click(toggleButton);
      expect(toggleButton).toHaveAttribute('aria-label', 'Mostrar contraseña');
    });
  });

  describe('Accessibility', () => {
    it('maintains aria-invalid prop', () => {
      render(<PasswordInput data-testid="password-input" aria-invalid={true} />);

      const input = screen.getByTestId('password-input');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('maintains aria-describedby prop', () => {
      render(<PasswordInput data-testid="password-input" aria-describedby="password-error" />);

      const input = screen.getByTestId('password-input');
      expect(input).toHaveAttribute('aria-describedby', 'password-error');
    });

    it('toggle button has tabIndex -1 to not interfere with tab flow', () => {
      render(<PasswordInput />);

      const toggleButton = screen.getByRole('button');
      expect(toggleButton).toHaveAttribute('tabIndex', '-1');
    });

    it('disables toggle button when input is disabled', () => {
      render(<PasswordInput data-testid="password-input" disabled />);

      const input = screen.getByTestId('password-input');
      const toggleButton = screen.getByRole('button');

      expect(input).toBeDisabled();
      expect(toggleButton).toBeDisabled();
    });
  });

  describe('Props Forwarding', () => {
    it('forwards standard input props', () => {
      render(
        <PasswordInput
          data-testid="password-input"
          id="test-password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter password"
        />
      );

      const input = screen.getByTestId('password-input');
      expect(input).toHaveAttribute('id', 'test-password');
      expect(input).toHaveAttribute('name', 'password');
      expect(input).toHaveAttribute('autocomplete', 'current-password');
      expect(input).toHaveAttribute('placeholder', 'Enter password');
    });

    it('forwards className to input', () => {
      render(<PasswordInput data-testid="password-input" className="custom-class" />);

      const input = screen.getByTestId('password-input');
      expect(input).toHaveClass('custom-class');
    });
  });
});
