/**
 * React hook for API calls with automatic token refresh
 */

import { useState, useCallback } from 'react';
import { api } from '../lib/api';

export const useAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const callAPI = useCallback(async (method, url, data = null, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      let result;

      switch (method.toLowerCase()) {
        case 'get':
          result = await api.get(url, options);
          break;
        case 'post':
          result = await api.post(url, data, options);
          break;
        case 'put':
          result = await api.put(url, data, options);
          break;
        case 'patch':
          result = await api.patch(url, data, options);
          break;
        case 'delete':
          result = await api.delete(url, options);
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      return result;
    } catch (err) {
      setError(err.message || 'An error occurred');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Convenience methods
  const get = useCallback((url, options) => callAPI('get', url, null, options), [callAPI]);
  const post = useCallback((url, data, options) => callAPI('post', url, data, options), [callAPI]);
  const put = useCallback((url, data, options) => callAPI('put', url, data, options), [callAPI]);
  const patch = useCallback(
    (url, data, options) => callAPI('patch', url, data, options),
    [callAPI]
  );
  const del = useCallback((url, options) => callAPI('delete', url, null, options), [callAPI]);

  return {
    loading,
    error,
    get,
    post,
    put,
    patch,
    delete: del,
    callAPI
  };
};

export default useAPI;
