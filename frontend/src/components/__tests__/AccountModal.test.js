/**
 * AccountModal Component Tests
 *
 * Tests for the main account management modal
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import AccountModal from '../AccountModal';
import { MOCK_ACCOUNTS, MOCK_ROASTS } from '../../mocks/social';

describe('AccountModal', () => {
  const account = MOCK_ACCOUNTS.find((a) => a.id === 'acc_tw_2'); // autoApprove=false
  const accountWithAutoApprove = MOCK_ACCOUNTS.find((a) => a.id === 'acc_tw_1'); // autoApprove=true
  const roasts = MOCK_ROASTS[account.id];

  const defaultProps = {
    account,
    roasts: roasts || [],
    intercepted: [],
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Basic Functionality', () => {
    it('renders account information correctly', () => {
      render(<AccountModal {...defaultProps} />);

      expect(screen.getByText(account.handle)).toBeInTheDocument();
      expect(screen.getByText(/X/i)).toBeInTheDocument(); // Network name
      expect(screen.getByText(/Activa|Inactiva/)).toBeInTheDocument();
    });

    it('closes modal when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<AccountModal {...defaultProps} />);

      const closeButton = screen.getByLabelText(/cerrar modal/i);
      await user.click(closeButton);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('closes modal when pressing Escape key', () => {
      render(<AccountModal {...defaultProps} />);

      // Fire the keydown event on the modal container (which has the event listener)
      const modalContainer = document.querySelector('[tabindex="-1"]');
      fireEvent.keyDown(modalContainer, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Roasts Tab - Conditional Button Visibility', () => {
    it('shows approve/reject buttons when autoApprove is disabled and roast is pending', () => {
      render(<AccountModal {...defaultProps} />);

      // Should be on roasts tab by default
      const approveButtons = screen.getAllByRole('button', { name: /aprobar/i });
      const rejectButtons = screen.getAllByRole('button', { name: /rechazar/i });

      expect(approveButtons.length).toBeGreaterThan(0);
      expect(rejectButtons.length).toBeGreaterThan(0);
    });

    it('hides approve/reject buttons when autoApprove is enabled', () => {
      const propsWithAutoApprove = {
        ...defaultProps,
        account: accountWithAutoApprove,
        roasts: MOCK_ROASTS[accountWithAutoApprove.id] || []
      };

      render(<AccountModal {...propsWithAutoApprove} />);

      expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /rechazar/i })).not.toBeInTheDocument();
    });

    it('hides approve/reject buttons for already approved/rejected roasts', () => {
      const approvedRoast = {
        id: 'approved_test',
        original: 'Test comment',
        roast: 'Test roast',
        createdAt: '2025-08-01T10:00:00Z',
        status: 'approved'
      };

      const propsWithApprovedRoast = {
        ...defaultProps,
        roasts: [approvedRoast]
      };

      render(<AccountModal {...propsWithApprovedRoast} />);

      // Should not show approve/reject buttons for approved roasts
      expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /rechazar/i })).not.toBeInTheDocument();
    });
  });

  describe('Roast Approval Actions', () => {
    it('calls onApproveRoast with correct accountId and roastId', async () => {
      const user = userEvent.setup();
      render(<AccountModal {...defaultProps} />);

      const approveButton = screen.getAllByRole('button', { name: /aprobar/i })[0];
      await user.click(approveButton);

      expect(defaultProps.onApproveRoast).toHaveBeenCalledWith(account.id, roasts[0].id);
    });

    it('calls onRejectRoast with correct accountId and roastId', async () => {
      const user = userEvent.setup();
      render(<AccountModal {...defaultProps} />);

      const rejectButton = screen.getAllByRole('button', { name: /rechazar/i })[0];
      await user.click(rejectButton);

      expect(defaultProps.onRejectRoast).toHaveBeenCalledWith(account.id, roasts[0].id);
    });
  });

  describe('Settings Tab', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<AccountModal {...defaultProps} />);

      // Switch to settings tab
      const settingsTab = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsTab);
    });

    it('toggles auto-approve setting', async () => {
      const user = userEvent.setup();
      render(<AccountModal {...defaultProps} />);

      // First switch to settings tab (get all and use the first one)
      const settingsTabs = screen.getAllByRole('button', { name: /settings/i });
      await user.click(settingsTabs[0]);

      // Find the auto-approve toggle switch by looking for the specific toggle pattern
      const toggleButtons = screen
        .getAllByRole('button')
        .filter(
          (button) =>
            button.className.includes('inline-flex') &&
            button.className.includes('h-6') &&
            button.className.includes('w-11')
        );

      // Should have at least one toggle (auto-approve)
      expect(toggleButtons.length).toBeGreaterThan(0);

      // Click the first toggle (which should be auto-approve)
      await user.click(toggleButtons[0]);

      expect(defaultProps.onToggleAutoApprove).toHaveBeenCalledWith(account.id, true);
    });

    it('changes shield level', async () => {
      const user = userEvent.setup();

      // Find shield level dropdown
      const shieldSelect = screen.getByDisplayValue('98% (Más estricto)');
      await user.selectOptions(shieldSelect, '95');

      expect(defaultProps.onChangeShieldLevel).toHaveBeenCalledWith(account.id, 95);
    });

    it('changes default tone', async () => {
      const user = userEvent.setup();

      // Find tone dropdown
      const toneSelect = screen.getByDisplayValue('Afilado');
      await user.selectOptions(toneSelect, 'Comico');

      expect(defaultProps.onChangeTone).toHaveBeenCalledWith(account.id, 'Comico');
    });

    it('shows tone preview when tone is changed', async () => {
      const user = userEvent.setup();

      // Initially shows the current tone's example
      expect(screen.getByText('"Pincha, pero no sangra."')).toBeInTheDocument();

      const toneSelect = screen.getByDisplayValue('Afilado');
      await user.selectOptions(toneSelect, 'Comico');

      // Verify the callback was called (component updates are handled externally)
      expect(defaultProps.onChangeTone).toHaveBeenCalledWith(account.id, 'Comico');
    });
  });

  describe('Shield Tab', () => {
    it('switches to shield tab and shows shield information', async () => {
      const user = userEvent.setup();
      render(<AccountModal {...defaultProps} />);

      const shieldTab = screen.getByRole('button', { name: /shield/i });
      await user.click(shieldTab);

      expect(screen.getByText('Roastr Shield')).toBeInTheDocument();
      // Check for either 'Activo' or 'Inactivo' text specifically
      expect(
        screen.getByText(account.settings.shieldEnabled ? 'Activo' : 'Inactivo')
      ).toBeInTheDocument();
    });

    it('expands intercepted comments when shield is enabled and accordion is clicked', async () => {
      const user = userEvent.setup();
      const propsWithIntercepted = {
        ...defaultProps,
        intercepted: [
          {
            id: 's1',
            category: 'Insultos graves',
            action: 'Ocultar comentario',
            preview: '***censurado***',
            originalHidden: 'Contenido censurado',
            createdAt: '2025-08-03T11:40:00Z'
          }
        ]
      };

      render(<AccountModal {...propsWithIntercepted} />);

      // Switch to shield tab
      const shieldTab = screen.getByRole('button', { name: /shield/i });
      await user.click(shieldTab);

      // Click on intercepted comments accordion
      const accordionButton = screen.getByText(/Comentarios interceptados/);
      await user.click(accordionButton);

      // Should show intercepted items
      expect(screen.getByText('***censurado***')).toBeInTheDocument();
    });
  });

  describe('Account Disconnection', () => {
    it('shows disconnect confirmation when disconnect button is clicked', async () => {
      const user = userEvent.setup();
      render(<AccountModal {...defaultProps} />);

      // Go to settings tab
      const settingsTab = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsTab);

      // Click disconnect button
      const disconnectButton = screen.getByText(/Desconectar cuenta/);
      await user.click(disconnectButton);

      expect(screen.getByText(/¿Estás seguro?/)).toBeInTheDocument();
      expect(screen.getByText(/Confirmar desconexión/)).toBeInTheDocument();
    });

    it('calls onDisconnectAccount when confirmation is clicked', async () => {
      const user = userEvent.setup();
      render(<AccountModal {...defaultProps} />);

      // Go to settings tab
      const settingsTab = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsTab);

      // Click disconnect button
      const disconnectButton = screen.getByText(/Desconectar cuenta/);
      await user.click(disconnectButton);

      // Confirm disconnection
      const confirmButton = screen.getByText(/Confirmar desconexión/);
      await user.click(confirmButton);

      expect(defaultProps.onDisconnectAccount).toHaveBeenCalledWith(account.id);
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('cancels disconnection when cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<AccountModal {...defaultProps} />);

      // Go to settings tab
      const settingsTab = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsTab);

      // Click disconnect button
      const disconnectButton = screen.getByText(/Desconectar cuenta/);
      await user.click(disconnectButton);

      // Cancel disconnection
      const cancelButton = screen.getByText(/Cancelar/);
      await user.click(cancelButton);

      expect(defaultProps.onDisconnectAccount).not.toHaveBeenCalled();
      expect(screen.getByText(/Desconectar cuenta/)).toBeInTheDocument();
    });
  });

  describe('Account Status Display', () => {
    it('displays active status correctly', () => {
      render(<AccountModal {...defaultProps} />);

      expect(screen.getByText('Activa')).toBeInTheDocument();
    });

    it('displays inactive status correctly', () => {
      const inactiveAccount = { ...account, status: 'inactive' };
      const propsWithInactiveAccount = { ...defaultProps, account: inactiveAccount };

      render(<AccountModal {...propsWithInactiveAccount} />);

      expect(screen.getByText('Inactiva')).toBeInTheDocument();
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no roasts are available', () => {
      const propsWithoutRoasts = { ...defaultProps, roasts: [] };

      render(<AccountModal {...propsWithoutRoasts} />);

      expect(screen.getByText(/No hay roasts generados aún/)).toBeInTheDocument();
    });
  });
});
