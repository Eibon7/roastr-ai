/**
 * Frontend Example: Using Cursor-Based Pagination for Notifications
 *
 * This example demonstrates how to implement cursor-based pagination
 * in the frontend to efficiently load notifications.
 */

class NotificationsPaginator {
  constructor(apiBaseUrl = '/api') {
    this.apiBaseUrl = apiBaseUrl;
    this.currentCursor = null;
    this.notifications = [];
    this.hasMore = true;
    this.loading = false;
  }

  /**
   * Load the first page of notifications
   * @param {Object} filters - Optional filters (status, type, include_expired)
   * @param {number} limit - Page size (default: 50, max: 100)
   * @returns {Promise<Object>} Response with notifications and pagination info
   */
  async loadFirst(filters = {}, limit = 50) {
    this.currentCursor = null;
    this.notifications = [];

    return await this.loadNotifications(filters, limit);
  }

  /**
   * Load the next page of notifications using cursor
   * @param {Object} filters - Optional filters (status, type, include_expired)
   * @param {number} limit - Page size
   * @returns {Promise<Object>} Response with notifications and pagination info
   */
  async loadNext(filters = {}, limit = 50) {
    if (!this.hasMore || this.loading) {
      return { success: false, error: 'No more data to load or already loading' };
    }

    return await this.loadNotifications(filters, limit);
  }

  /**
   * Internal method to load notifications with cursor-based pagination
   * @private
   */
  async loadNotifications(filters = {}, limit = 50) {
    if (this.loading) return { success: false, error: 'Already loading' };

    this.loading = true;

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('limit', Math.min(limit, 100).toString());

      // Add cursor if we have one (for subsequent pages)
      if (this.currentCursor) {
        params.append('cursor', this.currentCursor);
      }

      // Add filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`${this.apiBaseUrl}/notifications?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
          // Add authentication header if needed
          // 'Authorization': `Bearer ${yourAuthToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load notifications');
      }

      // Append new notifications to existing list (for infinite scroll)
      this.notifications = [...this.notifications, ...data.data.notifications];

      // Update pagination state
      this.hasMore = data.data.pagination.hasMore;
      this.currentCursor = data.data.pagination.nextCursor;

      return {
        success: true,
        notifications: data.data.notifications,
        totalLoaded: this.notifications.length,
        hasMore: this.hasMore,
        nextCursor: this.currentCursor
      };
    } catch (error) {
      console.error('Error loading notifications:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.loading = false;
    }
  }

  /**
   * Get all loaded notifications
   * @returns {Array} All notifications loaded so far
   */
  getAllNotifications() {
    return this.notifications;
  }

  /**
   * Check if there are more notifications to load
   * @returns {boolean} True if more data is available
   */
  canLoadMore() {
    return this.hasMore && !this.loading;
  }

  /**
   * Reset the paginator state
   */
  reset() {
    this.currentCursor = null;
    this.notifications = [];
    this.hasMore = true;
    this.loading = false;
  }
}

// Usage Examples:

// Example 1: Basic usage with infinite scroll
async function exampleInfiniteScroll() {
  const paginator = new NotificationsPaginator();

  // Load first page
  const firstPage = await paginator.loadFirst();
  if (firstPage.success) {
    console.log('First page loaded:', firstPage.notifications.length, 'notifications');
    renderNotifications(firstPage.notifications);
  }

  // Load more when user scrolls to bottom
  window.addEventListener('scroll', async () => {
    if (isNearBottom() && paginator.canLoadMore()) {
      const nextPage = await paginator.loadNext();
      if (nextPage.success) {
        console.log('Next page loaded:', nextPage.notifications.length, 'new notifications');
        appendNotifications(nextPage.notifications);
      }
    }
  });
}

// Example 2: Filtered notifications with cursor pagination
async function exampleFilteredNotifications() {
  const paginator = new NotificationsPaginator();

  const filters = {
    status: 'unread',
    type: 'payment_failed',
    include_expired: 'false'
  };

  // Load unread payment failed notifications
  const result = await paginator.loadFirst(filters, 25);
  if (result.success) {
    console.log('Loaded filtered notifications:', result.notifications);
    displayNotifications(result.notifications);
  }
}

// Example 3: Load all pages sequentially
async function exampleLoadAll() {
  const paginator = new NotificationsPaginator();
  let allNotifications = [];

  // Load first page
  let result = await paginator.loadFirst({}, 50);

  while (result.success && paginator.hasMore) {
    allNotifications = [...allNotifications, ...result.notifications];
    console.log(
      `Loaded ${result.notifications.length} notifications, total: ${allNotifications.length}`
    );

    // Load next page
    result = await paginator.loadNext({}, 50);
  }

  console.log('All notifications loaded:', allNotifications.length);
  return allNotifications;
}

// Example 4: React Hook for cursor-based pagination
function useNotificationsPagination() {
  const [notifications, setNotifications] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(null);

  const loadNotifications = useCallback(
    async (isFirstLoad = false, filters = {}) => {
      if (loading) return;

      setLoading(true);

      try {
        const params = new URLSearchParams();
        params.append('limit', '50');

        if (!isFirstLoad && cursor) {
          params.append('cursor', cursor);
        }

        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.append(key, value);
        });

        const response = await fetch(`/api/notifications?${params}`);
        const data = await response.json();

        if (data.success) {
          setNotifications((prev) =>
            isFirstLoad ? data.data.notifications : [...prev, ...data.data.notifications]
          );
          setHasMore(data.data.pagination.hasMore);
          setCursor(data.data.pagination.nextCursor);
        }
      } catch (error) {
        console.error('Error loading notifications:', error);
      } finally {
        setLoading(false);
      }
    },
    [cursor, loading]
  );

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadNotifications(false);
    }
  }, [hasMore, loading, loadNotifications]);

  const refresh = useCallback(() => {
    setCursor(null);
    setHasMore(true);
    loadNotifications(true);
  }, [loadNotifications]);

  return {
    notifications,
    hasMore,
    loading,
    loadMore,
    refresh
  };
}

// Helper functions for examples
function renderNotifications(notifications) {
  // Render initial notifications
  console.log('Rendering', notifications.length, 'notifications');
}

function appendNotifications(notifications) {
  // Append new notifications to existing list
  console.log('Appending', notifications.length, 'new notifications');
}

function displayNotifications(notifications) {
  // Display filtered notifications
  console.log('Displaying filtered notifications:', notifications);
}

function isNearBottom() {
  // Check if user has scrolled near bottom of page
  return window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000;
}

export { NotificationsPaginator, useNotificationsPagination };
