import {
  previewRoast,
  generateRoast,
  getRoastHistory,
  approveRoast,
  rejectRoast,
  generateVariant,
  getRoastStatistics
} from '../roast';

import { apiClient } from '../../lib/api';

jest.mock('../../lib/api', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn()
  }
}));

describe('roast API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('previews and generates roasts', async () => {
    apiClient.post.mockResolvedValue({ roast: 'ok' });
    await previewRoast('text', 0.5, 'balanced');
    await generateRoast('comment-123');
    expect(apiClient.post).toHaveBeenCalledWith('/roast/preview', expect.any(Object));
    expect(apiClient.post).toHaveBeenCalledWith('/roast/generate', expect.any(Object));
  });

  it('fetches history, approves, rejects and variants', async () => {
    apiClient.get.mockResolvedValue({ total: 1 });
    await getRoastHistory({ page: 1 });
    await getRoastStatistics();
    apiClient.post.mockResolvedValue({ success: true });
    await approveRoast('roast-1');
    await rejectRoast('roast-1', 'nope');
    await generateVariant('roast-1');
    expect(apiClient.get).toHaveBeenCalledWith('/roast/history?page=1');
    expect(apiClient.get).toHaveBeenCalledWith('/roast/statistics');
    expect(apiClient.post).toHaveBeenCalledWith('/roast/roast-1/approve', {});
    expect(apiClient.post).toHaveBeenCalledWith('/roast/roast-1/reject', { reason: 'nope' });
    expect(apiClient.post).toHaveBeenCalledWith('/roast/roast-1/variant', {});
  });
});

