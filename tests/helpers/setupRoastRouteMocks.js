/**
 * Shared setup helper for roast validation route tests
 * Issue #754 - CodeRabbit Review: Extract duplicated beforeEach logic
 *
 * This module provides reusable setup functions for Express app initialization
 * with roast route mocking, used across multiple test files.
 */

const express = require('express');
const { supabaseServiceClient } = require('../../src/config/supabase');
const { getPlanFeatures } = require('../../src/services/planService');
const { logger } = require('../../src/utils/logger');

/**
 * Configures Supabase mocks with table-aware behavior
 * @param {Object} mockRpc - Mock RPC function to configure
 * @returns {void}
 */
function setupSupabaseMocks(mockRpc) {
    // Mock Supabase RPC function
    supabaseServiceClient.rpc = mockRpc;

    supabaseServiceClient._currentTable = '';
    supabaseServiceClient.from = jest.fn().mockImplementation((table) => {
        supabaseServiceClient._currentTable = table;
        return supabaseServiceClient;
    });

    supabaseServiceClient.insert = jest.fn().mockResolvedValue({ data: null, error: null });
    supabaseServiceClient.select = jest.fn().mockReturnThis();
    supabaseServiceClient.eq = jest.fn().mockReturnThis();

    supabaseServiceClient.single = jest.fn().mockImplementation(() => {
        // Return different data based on which table is being queried
        if (supabaseServiceClient._currentTable === 'roasts') {
            return Promise.resolve({
                data: { user_id: 'test-user-id', content: 'Original roast content' },
                error: null
            });
        }
        // Default: user_subscriptions table
        return Promise.resolve({
            data: { plan: 'pro', status: 'active' },
            error: null
        });
    });
}

/**
 * Configures logger mocks
 * @returns {void}
 */
function setupLoggerMocks() {
    logger.info = jest.fn();
    logger.error = jest.fn();
    logger.warn = jest.fn();
}

/**
 * Configures plan service mocks
 * @returns {void}
 */
function setupPlanServiceMocks() {
    getPlanFeatures.mockReturnValue({
        limits: { roastsPerMonth: 1000 }
    });
}

/**
 * Main setup function - creates Express app with roast routes and all mocks configured
 * @param {Object} mockValidator - Mock StyleValidator instance
 * @param {Object} mockRpc - Mock RPC function
 * @returns {Object} Express app instance with routes configured
 */
function setupRoastTestApp(mockValidator, mockRpc) {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup express app
    const app = express();
    app.use(express.json());

    // Setup all mocks
    setupSupabaseMocks(mockRpc);
    setupLoggerMocks();
    setupPlanServiceMocks();

    // Import and setup routes after mocks
    const roastRoutes = require('../../src/routes/roast');
    app.use('/api/roast', roastRoutes);

    return app;
}

module.exports = {
    setupRoastTestApp,
    setupSupabaseMocks,
    setupLoggerMocks,
    setupPlanServiceMocks
};
