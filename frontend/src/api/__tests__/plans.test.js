import {
  getCurrentPlan,
  getAvailablePlans,
  upgradePlan,
  downgradePlan,
  cancelSubscription,
  getBillingHistory,
  getUpcomingInvoice
} from '../plans';

import { apiClient } from '../../lib/api';

jest.mock('../../lib/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn()
  }
}));

describe('plans API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gets plan and billing info', async () => {
    apiClient.get.mockResolvedValue({ plan_id: 'pro' });
    await getCurrentPlan();
    await getAvailablePlans();
    await getBillingHistory();
    await getUpcomingInvoice();
    expect(apiClient.get).toHaveBeenCalledWith('/plan/current');
    expect(apiClient.get).toHaveBeenCalledWith('/plans');
    expect(apiClient.get).toHaveBeenCalledWith('/billing/history');
    expect(apiClient.get).toHaveBeenCalledWith('/billing/upcoming');
  });

  it('submits plan changes and cancellation', async () => {
    apiClient.post.mockResolvedValue({ success: true });
    await upgradePlan('plus');
    await downgradePlan('starter');
    await cancelSubscription();
    expect(apiClient.post).toHaveBeenCalledWith('/plan/upgrade', { planId: 'plus' });
    expect(apiClient.post).toHaveBeenCalledWith('/plan/downgrade', { planId: 'starter' });
    expect(apiClient.post).toHaveBeenCalledWith('/plan/cancel', {});
  });
});
