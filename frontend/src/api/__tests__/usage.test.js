import {
  getCurrentUsage,
  getUsageHistory,
  getMonthlyUsage,
  getUsageBreakdown,
  getOptimizationRecommendations
} from '../usage';

import { apiClient } from '../../lib/api';

jest.mock('../../lib/api', () => ({
  apiClient: {
    get: jest.fn()
  }
}));

describe('usage API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches current usage', async () => {
    apiClient.get.mockResolvedValue({ total: 1 });
    await expect(getCurrentUsage()).resolves.toEqual({ total: 1 });
    expect(apiClient.get).toHaveBeenCalledWith('/usage');
  });

  it('passes query params to history and monthly endpoints', async () => {
    apiClient.get.mockResolvedValue({});
    await getUsageHistory('2025-01-01', '2025-01-31');
    expect(apiClient.get).toHaveBeenCalledWith('/usage/history?startDate=2025-01-01&endDate=2025-01-31');

    await getMonthlyUsage(5, 2025);
    expect(apiClient.get).toHaveBeenCalledWith('/usage/monthly?month=5&year=2025');
  });

  it('fetches breakdown and recommendations', async () => {
    await getUsageBreakdown();
    await getOptimizationRecommendations();
    expect(apiClient.get).toHaveBeenCalledWith('/usage/breakdown');
    expect(apiClient.get).toHaveBeenCalledWith('/usage/recommendations');
  });
});

