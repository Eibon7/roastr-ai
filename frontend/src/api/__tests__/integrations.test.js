import {
  getIntegrations,
  getIntegrationStatus,
  getAvailablePlatforms,
  connectPlatform,
  disconnectPlatform,
  updateIntegrationSettings,
  testIntegrationConnection,
  importFollowers,
  getImportProgress
} from '../integrations';

import { apiClient } from '../../lib/api';

jest.mock('../../lib/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn()
  }
}));

describe('integrations API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('forwards getIntegrations call', async () => {
    apiClient.get.mockResolvedValue({ data: { integrations: [{ name: 'twitter' }] } });
    await expect(getIntegrations()).resolves.toHaveProperty('data');
    expect(apiClient.get).toHaveBeenCalledWith('/integrations');
  });

  it('loads status and available platforms', async () => {
    await getIntegrationStatus();
    await getAvailablePlatforms();
    expect(apiClient.get).toHaveBeenNthCalledWith(1, '/integrations/status');
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/integrations/platforms');
  });

  it('connects/disconnects/integration settings', async () => {
    apiClient.post.mockResolvedValue({ success: true });
    await connectPlatform('twitter', { token: 'abc' });
    expect(apiClient.post).toHaveBeenCalledWith('/integrations/connect', {
      platform: 'twitter',
      credentials: { token: 'abc' }
    });

    apiClient.delete.mockResolvedValue({ success: true });
    await disconnectPlatform('integration-id');
    expect(apiClient.delete).toHaveBeenCalledWith('/integrations/integration-id');

    apiClient.patch.mockResolvedValue({ success: true });
    await updateIntegrationSettings('integration-id', { autoSync: true });
    expect(apiClient.patch).toHaveBeenCalledWith('/integrations/integration-id', {
      autoSync: true
    });
  });

  it('tests connection and imports followers', async () => {
    apiClient.post.mockResolvedValue({ status: 'ok' });
    await testIntegrationConnection('integration-id');
    expect(apiClient.post).toHaveBeenCalledWith('/integrations/integration-id/test', {});

    await importFollowers('twitter');
    expect(apiClient.post).toHaveBeenCalledWith('/integrations/import', { platform: 'twitter' });

    apiClient.get.mockResolvedValue({ progress: 0 });
    await getImportProgress('job-123');
    expect(apiClient.get).toHaveBeenCalledWith('/integrations/import/job-123/progress');
  });
});
