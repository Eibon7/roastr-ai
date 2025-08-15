/**
 * Tests for AccountModal Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { ToastProvider } from '../../contexts/ToastContext';
import AccountModal from '../AccountModal';

// Mock data
const mockAccount = {
  id: 'twitter-1',
  network: 'twitter',
  username: '@testuser',
  displayName: 'Test User',
  status: 'active',
  followers: 1500,
  monthlyRoasts: 45,
  lastActivity: '2024-08-14T10:30:00Z',
  settings: {
    autoApprove: false,
    shieldEnabled: true,
    shieldLevel: 'medium',
    defaultTone: 'sarcastic'
  }
};

const mockRoasts = [
  {
    id: 'roast-1',
    originalComment: 'Test comment',
    roastText: 'Test roast response',
    status: 'pending',
    createdAt: '2024-08-14T10:30:00Z',
    tone: 'sarcastic'
  },
  {
    id: 'roast-2',
    originalComment: 'Another comment',
    roastText: 'Another roast',
    status: 'approved',
    createdAt: '2024-08-14T11:00:00Z',
    tone: 'playful'
  }
];

const mockIntercepted = [
  {
    id: 'intercepted-1',
    originalComment: 'Toxic comment',
    toxicityScore: 0.9,
    reason: 'high_toxicity',
    createdAt: '2024-08-14T09:00:00Z'
  }
];

const mockHandlers = {
  onApproveRoast: jest.fn(),
  onRejectRoast: jest.fn(),
  onToggleAutoApprove: jest.fn(),
  onToggleAccount: jest.fn(),
  onChangeShieldLevel: jest.fn(),
  onToggleShield: jest.fn(),
  onChangeTone: jest.fn(),
  onDisconnectAccount: jest.fn(),
  onClose: jest.fn()
};

// Mock console to avoid noise in tests
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = jest.fn();
  // Reset all mock functions
  Object.values(mockHandlers).forEach(mock => mock.mockClear());
});

afterEach(() => {
  console.error = originalConsoleError;
});

const renderAccountModal = (props = {}) => {
  return render(
    <ToastProvider>
      <AccountModal
        account={mockAccount}
        roasts={mockRoasts}
        intercepted={mockIntercepted}
        {...mockHandlers}
        {...props}
      />
    </ToastProvider>
  );
};

describe('AccountModal', () => {
  describe('Rendering', () => {
    test('renders account information correctly', () => {
      renderAccountModal();
      
      expect(screen.getByText('@testuser')).toBeInTheDocument();
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('1.5k seguidores')).toBeInTheDocument();
      expect(screen.getByText('45 roasts este mes')).toBeInTheDocument();
    });

    test('renders tabs correctly', () => {
      renderAccountModal();
      
      expect(screen.getByText('Roasts')).toBeInTheDocument();
      expect(screen.getByText('Shield')).toBeInTheDocument();
      expect(screen.getByText('Configuración')).toBeInTheDocument();
    });

    test('renders roasts in default tab', () => {
      renderAccountModal();
      
      expect(screen.getByText('Test roast response')).toBeInTheDocument();
      expect(screen.getByText('Another roast')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    test('switches to Shield tab', async () => {
      const user = userEvent.setup();
      renderAccountModal();
      
      await user.click(screen.getByText('Shield'));
      
      expect(screen.getByText('Shield Interceptado')).toBeInTheDocument();
      expect(screen.getByText('Toxic comment')).toBeInTheDocument();
    });

    test('switches to Configuration tab', async () => {
      const user = userEvent.setup();
      renderAccountModal();
      
      await user.click(screen.getByText('Configuración'));
      
      expect(screen.getByText('Configuración de Cuenta')).toBeInTheDocument();
      expect(screen.getByText('Auto-aprobar roasts')).toBeInTheDocument();
    });
  });

  describe('Roast Actions', () => {
    test('approves roast when approve button clicked', async () => {
      const user = userEvent.setup();
      renderAccountModal();
      
      const approveButtons = screen.getAllByText('Aprobar');
      await user.click(approveButtons[0]);
      
      await waitFor(() => {
        expect(mockHandlers.onApproveRoast).toHaveBeenCalledWith('twitter-1', 'roast-1');
      });
    });

    test('rejects roast when reject button clicked', async () => {
      const user = userEvent.setup();
      renderAccountModal();
      
      const rejectButtons = screen.getAllByText('Rechazar');
      await user.click(rejectButtons[0]);
      
      await waitFor(() => {
        expect(mockHandlers.onRejectRoast).toHaveBeenCalledWith('twitter-1', 'roast-1');
      });
    });

    test('shows loading state during async actions', async () => {
      const user = userEvent.setup();
      
      // Make onApproveRoast async and delay
      mockHandlers.onApproveRoast.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      renderAccountModal();
      
      const approveButton = screen.getAllByText('Aprobar')[0];
      await user.click(approveButton);
      
      // Should show loading state briefly
      expect(screen.getByRole('button', { name: /aprobar/i })).toBeDisabled();
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /aprobar/i })).not.toBeDisabled();
      }, { timeout: 200 });
    });
  });

  describe('Configuration Settings', () => {
    test('toggles auto-approve setting', async () => {
      const user = userEvent.setup();
      renderAccountModal();
      
      await user.click(screen.getByText('Configuración'));
      
      const autoApproveToggle = screen.getByRole('checkbox', { name: /auto-aprobar roasts/i });
      await user.click(autoApproveToggle);
      
      await waitFor(() => {
        expect(mockHandlers.onToggleAutoApprove).toHaveBeenCalledWith('twitter-1', true);
      });
    });

    test('toggles account status', async () => {
      const user = userEvent.setup();
      renderAccountModal();
      
      await user.click(screen.getByText('Configuración'));
      
      const accountToggle = screen.getByRole('checkbox', { name: /cuenta activa/i });
      await user.click(accountToggle);
      
      await waitFor(() => {
        expect(mockHandlers.onToggleAccount).toHaveBeenCalledWith('twitter-1', 'inactive');
      });
    });

    test('changes default tone', async () => {
      const user = userEvent.setup();
      renderAccountModal();
      
      await user.click(screen.getByText('Configuración'));
      
      const toneSelect = screen.getByLabelText(/tono predeterminado/i);
      await user.selectOptions(toneSelect, 'playful');
      
      await waitFor(() => {
        expect(mockHandlers.onChangeTone).toHaveBeenCalledWith('twitter-1', 'playful');
      });
    });
  });

  describe('Shield Settings', () => {
    test('toggles shield on/off', async () => {
      const user = userEvent.setup();
      renderAccountModal();
      
      await user.click(screen.getByText('Configuración'));
      
      const shieldToggle = screen.getByRole('checkbox', { name: /shield habilitado/i });
      await user.click(shieldToggle);
      
      await waitFor(() => {
        expect(mockHandlers.onToggleShield).toHaveBeenCalledWith('twitter-1', false);
      });
    });

    test('changes shield level', async () => {
      const user = userEvent.setup();
      renderAccountModal();
      
      await user.click(screen.getByText('Configuración'));
      
      const shieldLevelSelect = screen.getByLabelText(/nivel de shield/i);
      await user.selectOptions(shieldLevelSelect, 'high');
      
      await waitFor(() => {
        expect(mockHandlers.onChangeShieldLevel).toHaveBeenCalledWith('twitter-1', 'high');
      });
    });
  });

  describe('Account Disconnection', () => {
    test('shows disconnect confirmation', async () => {
      const user = userEvent.setup();
      renderAccountModal();
      
      await user.click(screen.getByText('Configuración'));
      
      const disconnectButton = screen.getByText(/desconectar cuenta/i);
      await user.click(disconnectButton);
      
      expect(screen.getByText('¿Estás seguro?')).toBeInTheDocument();
      expect(screen.getByText(/esta acción no se puede deshacer/i)).toBeInTheDocument();
    });

    test('confirms account disconnection', async () => {
      const user = userEvent.setup();
      renderAccountModal();
      
      await user.click(screen.getByText('Configuración'));
      
      const disconnectButton = screen.getByText(/desconectar cuenta/i);
      await user.click(disconnectButton);
      
      const confirmButton = screen.getByText('Sí, desconectar');
      await user.click(confirmButton);
      
      await waitFor(() => {
        expect(mockHandlers.onDisconnectAccount).toHaveBeenCalledWith('twitter-1');
      });
    });

    test('cancels account disconnection', async () => {
      const user = userEvent.setup();
      renderAccountModal();
      
      await user.click(screen.getByText('Configuración'));
      
      const disconnectButton = screen.getByText(/desconectar cuenta/i);
      await user.click(disconnectButton);
      
      const cancelButton = screen.getByText('Cancelar');
      await user.click(cancelButton);
      
      expect(screen.queryByText('¿Estás seguro?')).not.toBeInTheDocument();
      expect(mockHandlers.onDisconnectAccount).not.toHaveBeenCalled();
    });
  });

  describe('Modal Behavior', () => {
    test('closes on Escape key press', () => {
      renderAccountModal();
      
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      
      expect(mockHandlers.onClose).toHaveBeenCalled();
    });

    test('closes on backdrop click', async () => {
      const user = userEvent.setup();
      renderAccountModal();
      
      const backdrop = screen.getByTestId('modal-backdrop') || 
                       document.querySelector('.fixed.inset-0');
      
      if (backdrop) {
        await user.click(backdrop);
        expect(mockHandlers.onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handling', () => {
    test('handles async action errors gracefully', async () => {
      const user = userEvent.setup();
      
      // Make handler reject
      mockHandlers.onApproveRoast.mockRejectedValue(new Error('Network error'));
      
      renderAccountModal();
      
      const approveButton = screen.getAllByText('Aprobar')[0];
      await user.click(approveButton);
      
      await waitFor(() => {
        // Should not crash and button should be re-enabled
        expect(screen.getByRole('button', { name: /aprobar/i })).not.toBeDisabled();
      });
    });
  });
});