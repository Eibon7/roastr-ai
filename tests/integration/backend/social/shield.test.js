/**
 * Backend Integration Tests - Shield Protection
 * 
 * Tests Shield intercepted comments and filtering against real backend
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

describe('Backend Integration - Shield Protection', () => {
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

  describe('Shield Intercepted Comments (GET)', () => {
    it('should fetch intercepted comments from backend', async () => {
      const shieldData = await loadFixtureIfNeeded('shield.json', () => 
        socialAPI.getShieldIntercepted(testAccount.id, { limit: 10 })
      );

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        interceptedByAccount: jest.fn(() => shieldData.data.intercepted),
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

      // Navigate to Shield tab
      const shieldTab = await screen.findByText('Shield');
      await userEvent.click(shieldTab);

      await waitFor(() => {
        shieldData.data.intercepted.forEach(item => {
          expect(screen.getByText(item.category)).toBeInTheDocument();
          expect(screen.getByText(item.action)).toBeInTheDocument();
          expect(screen.getByText(item.preview)).toBeInTheDocument();
        });
      });
    });

    it('should display Shield statistics correctly', async () => {
      const shieldData = await loadFixtureIfNeeded('shield.json', () => 
        socialAPI.getShieldIntercepted(testAccount.id)
      );

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        interceptedByAccount: jest.fn(() => shieldData.data.intercepted),
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

      const shieldTab = await screen.findByText('Shield');
      await userEvent.click(shieldTab);

      await waitFor(() => {
        const summary = shieldData.data.summary;
        
        expect(screen.getByText(summary.totalIntercepted.toString())).toBeInTheDocument();
        expect(screen.getByText(summary.last24Hours.toString())).toBeInTheDocument();
        
        // Check effectiveness rate
        const effectivenessPercent = Math.round(summary.effectivenessRate * 100);
        expect(screen.getByText(`${effectivenessPercent}%`)).toBeInTheDocument();
      });
    });

    it('should filter intercepted items by category', async () => {
      const shieldData = await loadFixtureIfNeeded('shield.json', () => 
        socialAPI.getShieldIntercepted(testAccount.id)
      );

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        interceptedByAccount: jest.fn(() => shieldData.data.intercepted),
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

      const shieldTab = await screen.findByText('Shield');
      await userEvent.click(shieldTab);

      // Test filtering by "Insultos graves"
      const categoryFilter = await screen.findByTestId('shield-category-filter');
      await userEvent.selectOptions(categoryFilter, 'Insultos graves');

      await waitFor(() => {
        const insultosGraves = shieldData.data.intercepted.filter(
          item => item.category === 'Insultos graves'
        );
        const otherCategories = shieldData.data.intercepted.filter(
          item => item.category !== 'Insultos graves'
        );

        // Should show only "Insultos graves" items
        insultosGraves.forEach(item => {
          expect(screen.getByText(item.preview)).toBeInTheDocument();
        });

        // Should hide other categories
        otherCategories.forEach(item => {
          expect(screen.queryByText(item.preview)).not.toBeInTheDocument();
        });
      });
    });

    it('should filter intercepted items by action taken', async () => {
      const shieldData = await loadFixtureIfNeeded('shield.json', () => 
        socialAPI.getShieldIntercepted(testAccount.id)
      );

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        interceptedByAccount: jest.fn(() => shieldData.data.intercepted),
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

      const shieldTab = await screen.findByText('Shield');
      await userEvent.click(shieldTab);

      // Test filtering by "Bloquear usuario"
      const actionFilter = await screen.findByTestId('shield-action-filter');
      await userEvent.selectOptions(actionFilter, 'Bloquear usuario');

      await waitFor(() => {
        const blockedUsers = shieldData.data.intercepted.filter(
          item => item.action === 'Bloquear usuario'
        );

        blockedUsers.forEach(item => {
          expect(screen.getByText(item.preview)).toBeInTheDocument();
          expect(screen.getByText(item.action)).toBeInTheDocument();
        });

        // Verify count matches filter
        expect(screen.getByText(`${blockedUsers.length} elementos`)).toBeInTheDocument();
      });
    });

    it('should show detailed view when expanding intercepted item', async () => {
      const user = userEvent.setup();
      const shieldData = await loadFixtureIfNeeded('shield.json', () => 
        socialAPI.getShieldIntercepted(testAccount.id)
      );

      const firstItem = shieldData.data.intercepted[0];

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        interceptedByAccount: jest.fn(() => shieldData.data.intercepted),
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

      const shieldTab = await screen.findByText('Shield');
      await user.click(shieldTab);

      // Click expand button on first intercepted item
      const expandButton = await screen.findByTestId(`expand-shield-${firstItem.id}`);
      await user.click(expandButton);

      await waitFor(() => {
        // Should show additional details
        expect(screen.getByText(`Nivel de toxicidad: ${Math.round(firstItem.toxicityScore * 100)}%`)).toBeInTheDocument();
        expect(screen.getByText(`Confianza: ${Math.round(firstItem.confidence * 100)}%`)).toBeInTheDocument();
        expect(screen.getByText(firstItem.source.authorHandle)).toBeInTheDocument();
        expect(screen.getByText(firstItem.source.context)).toBeInTheDocument();
      });
    });
  });

  describe('Shield Settings Management', () => {
    it('should update Shield enabled/disabled state', async () => {
      const user = userEvent.setup();
      
      const mockOnToggleShield = jest.fn(async (accountId, enabled) => {
        return await socialAPI.updateShieldSettings(accountId, { enabled });
      });

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        interceptedByAccount: jest.fn(() => []),
        onToggleShield: mockOnToggleShield,
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

      const shieldTab = await screen.findByText('Shield');
      await user.click(shieldTab);

      const shieldToggle = await screen.findByTestId('shield-enabled-toggle');
      await user.click(shieldToggle);

      await waitFor(() => {
        expect(mockOnToggleShield).toHaveBeenCalledWith(
          testAccount.id, 
          !testAccount.settings.shieldEnabled
        );
      });
    });

    it('should update Shield level setting', async () => {
      const user = userEvent.setup();
      
      const mockOnChangeShieldLevel = jest.fn(async (accountId, level) => {
        return await socialAPI.updateShieldSettings(accountId, { threshold: level });
      });

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        interceptedByAccount: jest.fn(() => []),
        onToggleShield: jest.fn(),
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

      const shieldTab = await screen.findByText('Shield');
      await user.click(shieldTab);

      const shieldLevelSlider = await screen.findByTestId('shield-level-slider');
      
      // Change Shield level to 90
      fireEvent.change(shieldLevelSlider, { target: { value: '90' } });

      await waitFor(() => {
        expect(mockOnChangeShieldLevel).toHaveBeenCalledWith(testAccount.id, 90);
      });
    });

    it('should show Shield level recommendations', async () => {
      const settingsData = await loadFixtureIfNeeded('settings.json', () => 
        socialAPI.getAccountSettings(testAccount.id)
      );

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        interceptedByAccount: jest.fn(() => []),
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

      const shieldTab = await screen.findByText('Shield');
      await userEvent.click(shieldTab);

      await waitFor(() => {
        const recommendations = settingsData.data.validation.recommendations;
        
        recommendations.forEach(recommendation => {
          expect(screen.getByText(recommendation)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Shield Categories Management', () => {
    it('should display category breakdown from backend', async () => {
      const shieldData = await loadFixtureIfNeeded('shield.json', () => 
        socialAPI.getShieldIntercepted(testAccount.id)
      );

      mockUseSocialAccounts.mockReturnValue({
        getAccountById: jest.fn(() => testAccount),
        interceptedByAccount: jest.fn(() => shieldData.data.intercepted),
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

      const shieldTab = await screen.findByText('Shield');
      await userEvent.click(shieldTab);

      await waitFor(() => {
        const breakdown = shieldData.data.summary.categoriesBreakdown;
        
        Object.entries(breakdown).forEach(([category, count]) => {
          expect(screen.getByText(category)).toBeInTheDocument();
          expect(screen.getByText(count.toString())).toBeInTheDocument();
        });
      });
    });

    it('should validate action effectiveness from backend data', async () => {
      const shieldData = await loadFixtureIfNeeded('shield.json', () => 
        socialAPI.getShieldIntercepted(testAccount.id)
      );

      // Verify that actions match what backend reported
      const actionsBreakdown = shieldData.data.summary.actionsBreakdown;
      const totalActions = Object.values(actionsBreakdown).reduce((sum, count) => sum + count, 0);
      const effectivenessRate = shieldData.data.summary.effectivenessRate;

      expect(totalActions).toBe(shieldData.data.summary.totalIntercepted);
      expect(effectivenessRate).toBeGreaterThanOrEqual(0);
      expect(effectivenessRate).toBeLessThanOrEqual(1);

      // Verify each action category has valid counts
      Object.entries(actionsBreakdown).forEach(([action, count]) => {
        expect(count).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(count)).toBe(true);
      });
    });
  });

  describe('Real API Response Validation', () => {
    it('should handle paginated Shield data correctly', async () => {
      const firstPage = await socialAPI.getShieldIntercepted(testAccount.id, { limit: 2 });
      
      expect(firstPage).toHaveProperty('success', true);
      expect(firstPage.data).toHaveProperty('intercepted');
      expect(firstPage.data).toHaveProperty('pagination');
      expect(Array.isArray(firstPage.data.intercepted)).toBe(true);
      expect(firstPage.data.intercepted.length).toBeLessThanOrEqual(2);

      if (firstPage.data.pagination.hasMore) {
        const secondPage = await socialAPI.getShieldIntercepted(testAccount.id, { 
          limit: 2,
          cursor: firstPage.data.pagination.nextCursor 
        });

        expect(secondPage.data.intercepted.length).toBeGreaterThan(0);
        expect(secondPage.data.intercepted[0].id).not.toBe(firstPage.data.intercepted[0]?.id);
      }
    });

    it('should validate intercepted item schema from backend', async () => {
      const response = await socialAPI.getShieldIntercepted(testAccount.id, { limit: 1 });
      
      if (response.data.intercepted.length > 0) {
        const item = response.data.intercepted[0];
        
        // Validate required fields
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('action');
        expect(item).toHaveProperty('preview');
        expect(item).toHaveProperty('toxicityScore');
        expect(item).toHaveProperty('createdAt');
        expect(item).toHaveProperty('source');
        
        // Validate field types and ranges
        expect(typeof item.id).toBe('string');
        expect(typeof item.category).toBe('string');
        expect(typeof item.action).toBe('string');
        expect(typeof item.toxicityScore).toBe('number');
        expect(item.toxicityScore).toBeGreaterThanOrEqual(0);
        expect(item.toxicityScore).toBeLessThanOrEqual(1);
        expect(new Date(item.createdAt)).toBeInstanceOf(Date);
        
        // Validate source object
        expect(item.source).toHaveProperty('platform');
        expect(item.source).toHaveProperty('authorHandle');
        expect(typeof item.source.platform).toBe('string');
        expect(typeof item.source.authorHandle).toBe('string');
      }
    });

    it('should validate Shield settings update responses', async () => {
      const updateResponse = await socialAPI.updateShieldSettings(testAccount.id, { 
        enabled: true,
        threshold: 90 
      });
      
      expect(updateResponse).toHaveProperty('success', true);
      
      // Verify the settings were actually updated by fetching them
      const settingsResponse = await socialAPI.getAccountSettings(testAccount.id);
      expect(settingsResponse.data.settings.shield.enabled).toBe(true);
      expect(settingsResponse.data.settings.shield.level).toBe(90);
    });
  });
});