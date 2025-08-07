const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    throw new Error('Supabase environment variables are not set. Please check SUPABASE_URL, SUPABASE_SERVICE_KEY, and SUPABASE_ANON_KEY.');
}

// Service client for admin operations (bypasses RLS)
const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Anonymous client for auth operations
const supabaseAnonClient = createClient(supabaseUrl, supabaseAnonKey);

// Function to create authenticated client for specific user
const createUserClient = (accessToken) => {
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    });
};

// Helper to get user from JWT
const getUserFromToken = async (token) => {
    try {
        const { data: { user }, error } = await supabaseAnonClient.auth.getUser(token);
        
        if (error) {
            logger.warn('Failed to get user from token:', error.message);
            return null;
        }
        
        return user;
    } catch (error) {
        logger.error('Error getting user from token:', error.message);
        return null;
    }
};

// Health check function
const checkConnection = async () => {
    try {
        const { data, error } = await supabaseServiceClient
            .from('users')
            .select('id')
            .limit(1);
            
        if (error) {
            throw new Error(`Database connection failed: ${error.message}`);
        }
        
        return { connected: true };
    } catch (error) {
        logger.error('Supabase connection check failed:', error.message);
        return { connected: false, error: error.message };
    }
};

module.exports = {
    supabaseServiceClient,
    supabaseAnonClient,
    createUserClient,
    getUserFromToken,
    checkConnection
};