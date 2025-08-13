/**
 * Backend Integration Tests - Account Settings
 * 
 * Tests account settings GET and PUT operations against real backend
 * Run with: REACT_APP_ENABLE_MOCK_MODE=false npm run test:integration-backend
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import AccountModal from '../../../../frontend/src/components/AccountModal';
import { useSocialAccounts } from '../../../../frontend/src/hooks/useSocialAccounts';
import socialAPI from '../../../../frontend/src/api/social';

// Test utilities
import { 
  setupRealBackendTest, 
  teardownRealBackendTest,
  authenticateTestUser,
  loadFixtureIfNeeded,
  createTestAccount 
} from '../utils/backendTestUtils';

jest.mock('../../../../frontend/src/hooks/useSocialAccounts');
const mockUseSocialAccounts = useSocialAccounts;

describe('Backend Integration - Account Settings', () => {
  let testContext;
  let testAccount;

  beforeAll(async () => {
    testContext = await setupRealBackendTest();
    testAccount = await createTestAccount(testContext, 'twitter');
  });

  afterAll(async () => {
    await teardownRealBackendTest(testContext);
  });

  beforeEach(async () => {
    await authenticateTestUser(testContext);
  });

  describe('Settings Loading (GET)', () => {
    it('should load account settings from backend and display correctly', async () => {
      const settingsData = await loadFixtureIfNeeded('settings.json', () => 
        socialAPI.getAccountSettings(testAccount.id)
      );

      const accountWithSettings = {
        ...testAccount,
        settings: settingsData.data.settings.general
      };

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => accountWithSettings),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeTone: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeShieldLevel: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={accountWithSettings}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      // Navigate to Settings tab
      const settingsTab = await screen.findByText('Settings');
      await userEvent.click(settingsTab);

      await waitFor(() => {
        const settings = settingsData.data.settings.general;
        
        // Verify auto-approval toggle state
        const autoApproveToggle = screen.getByTestId('auto-approve-toggle');
        expect(autoApproveToggle).toHaveProperty('checked', settings.autoApprove);

        // Verify account active state
        const accountActiveToggle = screen.getByTestId('account-active-toggle');
        expect(accountActiveToggle).toHaveProperty('checked', settings.active);

        // Verify default tone selection
        const toneSelect = screen.getByTestId('default-tone-select');
        expect(toneSelect).toHaveValue(settings.defaultTone);
      });
    });

    it('should display Shield settings correctly', async () => {
      const settingsData = await loadFixtureIfNeeded('settings.json', () => 
        socialAPI.getAccountSettings(testAccount.id)
      );

      const accountWithSettings = {
        ...testAccount,
        settings: {
          ...settingsData.data.settings.general,
          shieldEnabled: settingsData.data.settings.shield.enabled,
          shieldLevel: settingsData.data.settings.shield.level
        }
      };

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => accountWithSettings),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeTone: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeShieldLevel: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={accountWithSettings}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      const settingsTab = await screen.findByText('Settings');
      await userEvent.click(settingsTab);

      await waitFor(() => {
        const shieldSettings = settingsData.data.settings.shield;
        
        // Verify Shield enabled toggle
        const shieldToggle = screen.getByTestId('shield-enabled-toggle');
        expect(shieldToggle).toHaveProperty('checked', shieldSettings.enabled);

        // Verify Shield level slider
        const shieldLevelSlider = screen.getByTestId('shield-level-slider');
        expect(shieldLevelSlider).toHaveValue(shieldSettings.level.toString());

        // Verify Shield level display
        expect(screen.getByText(`${shieldSettings.level}%`)).toBeInTheDocument();
      });
    });

    it('should show available tone options from backend', async () => {
      const settingsData = await loadFixtureIfNeeded('settings.json', () => 
        socialAPI.getAccountSettings(testAccount.id)
      );

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeTone: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeShieldLevel: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={testAccount}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      const settingsTab = await screen.findByText('Settings');
      await userEvent.click(settingsTab);

      await waitFor(() => {
        const availableTones = settingsData.data.availableOptions.tones;
        
        availableTones.forEach(tone => {
          expect(screen.getByText(tone.name)).toBeInTheDocument();
          // Check if descriptions are shown in tooltips or help text
          if (tone.description) {
            expect(screen.getByText(tone.description)).toBeInTheDocument();
          }
        });
      });
    });

    it('should display validation warnings and recommendations', async () => {
      const settingsData = await loadFixtureIfNeeded('settings.json', () => 
        socialAPI.getAccountSettings(testAccount.id)
      );

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeTone: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeShieldLevel: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={testAccount}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      const settingsTab = await screen.findByText('Settings');
      await userEvent.click(settingsTab);

      await waitFor(() => {
        const validation = settingsData.data.validation;
        
        // Check for warnings
        validation.warnings.forEach(warning => {
          expect(screen.getByText(warning)).toBeInTheDocument();
        });

        // Check for recommendations
        validation.recommendations.forEach(recommendation => {
          expect(screen.getByText(recommendation)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Settings Updates (PUT)', () => {
    it('should update auto-approval setting and reflect in backend', async () => {
      const user = userEvent.setup();
      
      const mockOnToggleAutoApprove = jest.fn(async (accountId, enabled) => {
        return await socialAPI.updateAccountSettings(accountId, { autoApprove: enabled });
      });

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        onToggleAutoApprove: mockOnToggleAutoApprove,
        onToggleAccount: jest.fn(),
        onChangeTone: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeShieldLevel: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={testAccount}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      const settingsTab = await screen.findByText('Settings');
      await user.click(settingsTab);

      const autoApproveToggle = await screen.findByTestId('auto-approve-toggle');
      await user.click(autoApproveToggle);

      await waitFor(() => {
        expect(mockOnToggleAutoApprove).toHaveBeenCalledWith(
          testAccount.id, 
          !testAccount.settings.autoApprove
        );
      });
    });

    it('should update account status and reflect in backend', async () => {
      const user = userEvent.setup();
      
      const mockOnToggleAccount = jest.fn(async (accountId, status) => {
        const active = status === 'active';
        return await socialAPI.updateAccountSettings(accountId, { active });
      });

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: mockOnToggleAccount,
        onChangeTone: jest.fn(),
        onToggleShield: jest.fn(),
        onChangeShieldLevel: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={testAccount}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      const settingsTab = await screen.findByText('Settings');
      await user.click(settingsTab);

      const accountToggle = await screen.findByTestId('account-active-toggle');
      await user.click(accountToggle);

      await waitFor(() => {
        const newStatus = testAccount.status === 'active' ? 'inactive' : 'active';
        expect(mockOnToggleAccount).toHaveBeenCalledWith(testAccount.id, newStatus);
      });
    });

    it('should update default tone setting', async () => {
      const user = userEvent.setup();
      
      const mockOnChangeTone = jest.fn(async (accountId, tone) => {
        return await socialAPI.updateAccountSettings(accountId, { defaultTone: tone });
      });

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeTone: mockOnChangeTone,
        onToggleShield: jest.fn(),
        onChangeShieldLevel: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={testAccount}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      const settingsTab = await screen.findByText('Settings');
      await user.click(settingsTab);

      const toneSelect = await screen.findByTestId('default-tone-select');
      await user.selectOptions(toneSelect, 'Sarcástico');

      await waitFor(() => {
        expect(mockOnChangeTone).toHaveBeenCalledWith(testAccount.id, 'Sarcástico');
      });
    });

    it('should update Shield settings via PUT requests', async () => {
      const user = userEvent.setup();
      
      const mockOnToggleShield = jest.fn(async (accountId, enabled) => {
        return await socialAPI.updateShieldSettings(accountId, { enabled });
      });

      const mockOnChangeShieldLevel = jest.fn(async (accountId, level) => {
        return await socialAPI.updateShieldSettings(accountId, { threshold: level });
      });

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeTone: jest.fn(),
        onToggleShield: mockOnToggleShield,
        onChangeShieldLevel: mockOnChangeShieldLevel,
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={testAccount}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      const settingsTab = await screen.findByText('Settings');
      await user.click(settingsTab);

      // Test Shield toggle
      const shieldToggle = await screen.findByTestId('shield-enabled-toggle');
      await user.click(shieldToggle);

      // Test Shield level change
      const shieldLevelSlider = await screen.findByTestId('shield-level-slider');
      fireEvent.change(shieldLevelSlider, { target: { value: '85' } });

      await waitFor(() => {
        expect(mockOnToggleShield).toHaveBeenCalledWith(
          testAccount.id, 
          !testAccount.settings.shieldEnabled
        );
        expect(mockOnChangeShieldLevel).toHaveBeenCalledWith(testAccount.id, 85);
      });
    });

    it('should handle settings update errors gracefully', async () => {
      const user = userEvent.setup();
      
      const mockOnChangeTone = jest.fn(async () => {
        throw new Error('Backend settings update failed');
      });

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeTone: mockOnChangeTone,
        onToggleShield: jest.fn(),
        onChangeShieldLevel: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={testAccount}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      const settingsTab = await screen.findByText('Settings');
      await user.click(settingsTab);

      const toneSelect = await screen.findByTestId('default-tone-select');
      await user.selectOptions(toneSelect, 'Sarcástico');

      await waitFor(() => {
        expect(screen.getByText(/error al actualizar configuración/i)).toBeInTheDocument();
      });
    });
  });

  describe('Multi-Account Settings', () => {
    it('should handle settings for multiple accounts independently', async () => {
      const account1 = { ...testAccount, id: 'acc_1', handle: '@test1' };
      const account2 = { ...testAccount, id: 'acc_2', handle: '@test2' };

      // Load different settings for each account
      const settings1 = await loadFixtureIfNeeded('settings.json', () => 
        socialAPI.getAccountSettings(account1.id)
      );
      
      // Modify settings for second account
      const settings2 = {
        ...settings1,
        data: {
          ...settings1.data,
          settings: {
            ...settings1.data.settings,
            general: {
              ...settings1.data.settings.general,
              autoApprove: false,
              defaultTone: 'Seco'
            }
          }
        }
      };

      const mockOnChangeTone = jest.fn(async (accountId, tone) => {
        return await socialAPI.updateAccountSettings(accountId, { defaultTone: tone });
      });

      // Test first account
      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn((id) => id === account1.id ? account1 : account2),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeTone: mockOnChangeTone,
        onToggleShield: jest.fn(),
        onChangeShieldLevel: jest.fn(),
      });

      const { rerender } = render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={account1}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      let settingsTab = await screen.findByText('Settings');
      await userEvent.click(settingsTab);

      let toneSelect = await screen.findByTestId('default-tone-select');
      expect(toneSelect).toHaveValue(settings1.data.settings.general.defaultTone);

      // Test second account
      rerender(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={account2}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      settingsTab = await screen.findByText('Settings');
      await userEvent.click(settingsTab);

      toneSelect = await screen.findByTestId('default-tone-select');
      expect(toneSelect).toHaveValue(settings2.data.settings.general.defaultTone);
    });

    it('should not affect other accounts when updating one account settings', async () => {
      const account1 = { ...testAccount, id: 'acc_1' };
      const account2 = { ...testAccount, id: 'acc_2' };

      const mockOnChangeTone = jest.fn(async (accountId, tone) => {
        // Verify that only the specific account is updated
        expect(accountId).toBe(account1.id);
        return await socialAPI.updateAccountSettings(accountId, { defaultTone: tone });
      });

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => account1),
        onToggleAutoApprove: jest.fn(),
        onToggleAccount: jest.fn(),
        onChangeTone: mockOnChangeTone,
        onToggleShield: jest.fn(),
        onChangeShieldLevel: jest.fn(),
      });

      render(
        <BrowserRouter>
          <AccountModal 
            isOpen={true}
            account={account1}
            onClose={jest.fn()}
          />
        </BrowserRouter>
      );

      const settingsTab = await screen.findByText('Settings');
      await userEvent.click(settingsTab);

      const toneSelect = await screen.findByTestId('default-tone-select');
      await userEvent.selectOptions(toneSelect, 'Afilado');

      await waitFor(() => {
        expect(mockOnChangeTone).toHaveBeenCalledWith(account1.id, 'Afilado');
        expect(mockOnChangeTone).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Real API Response Validation', () => {
    it('should validate settings GET response schema', async () => {
      const response = await socialAPI.getAccountSettings(testAccount.id);
      
      expect(response).toHaveProperty('success', true);
      expect(response).toHaveProperty('data');
      expect(response.data).toHaveProperty('settings');
      
      const settings = response.data.settings;
      
      // Validate general settings
      expect(settings).toHaveProperty('general');
      expect(settings.general).toHaveProperty('active');
      expect(settings.general).toHaveProperty('autoApprove');
      expect(settings.general).toHaveProperty('defaultTone');
      expect(typeof settings.general.active).toBe('boolean');
      expect(typeof settings.general.autoApprove).toBe('boolean');
      expect(typeof settings.general.defaultTone).toBe('string');
      
      // Validate Shield settings
      expect(settings).toHaveProperty('shield');
      expect(settings.shield).toHaveProperty('enabled');
      expect(settings.shield).toHaveProperty('level');
      expect(typeof settings.shield.enabled).toBe('boolean');
      expect(typeof settings.shield.level).toBe('number');
      expect(settings.shield.level).toBeGreaterThanOrEqual(80);
      expect(settings.shield.level).toBeLessThanOrEqual(100);
    });

    it('should validate settings PUT response', async () => {
      const updateData = {
        autoApprove: false,
        defaultTone: 'Sarcástico'
      };

      const response = await socialAPI.updateAccountSettings(testAccount.id, updateData);
      
      expect(response).toHaveProperty('success', true);
      
      // Verify the update took effect by fetching settings
      const settingsResponse = await socialAPI.getAccountSettings(testAccount.id);
      expect(settingsResponse.data.settings.general.autoApprove).toBe(updateData.autoApprove);
      expect(settingsResponse.data.settings.general.defaultTone).toBe(updateData.defaultTone);
    });

    it('should validate Shield settings PUT response', async () => {
      const shieldUpdateData = {
        enabled: true,
        threshold: 88
      };

      const response = await socialAPI.updateShieldSettings(testAccount.id, shieldUpdateData);
      
      expect(response).toHaveProperty('success', true);
      
      // Verify Shield settings were updated
      const settingsResponse = await socialAPI.getAccountSettings(testAccount.id);
      expect(settingsResponse.data.settings.shield.enabled).toBe(shieldUpdateData.enabled);
      expect(settingsResponse.data.settings.shield.level).toBe(shieldUpdateData.threshold);
    });

    it('should handle invalid settings updates with proper errors', async () => {
      const invalidUpdateData = {
        defaultTone: 'InvalidTone',
        autoApprove: 'not_a_boolean'
      };

      try {
        await socialAPI.updateAccountSettings(testAccount.id, invalidUpdateData);
        fail('Expected API to reject invalid settings');
      } catch (error) {
        expect(error.message).toMatch(/validation|invalid|error/i);
      }
    });
  });
});