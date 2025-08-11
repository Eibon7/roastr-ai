const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Check if we're in mock mode - if variables are missing, create mock clients
const isSupabaseConfigured = supabaseUrl && supabaseServiceKey && supabaseAnonKey;

if (!isSupabaseConfigured) {
    console.warn('🔄 Supabase environment variables not set - running in mock mode');
}

// Create mock client for when Supabase is not configured
const createMockClient = () => ({
    auth: {
        getUser: async () => ({ data: { user: null }, error: new Error('Mock mode - no user') })
    },
    from: () => ({
        select: () => ({
            limit: () => Promise.resolve({ data: [], error: new Error('Mock mode - no database') })
        })
    })
});

// Service client for admin operations (bypasses RLS)
const supabaseServiceClient = isSupabaseConfigured 
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
    : createMockClient();

// Anonymous client for auth operations
const supabaseAnonClient = isSupabaseConfigured 
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createMockClient();

// Function to create authenticated client for specific user
const createUserClient = (accessToken) => {
    if (!isSupabaseConfigured) {
        return createMockClient();
    }
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
    // In mock mode or testing, return a valid mock user for any token
    if (!isSupabaseConfigured || process.env.NODE_ENV === 'test' || process.env.ENABLE_MOCK_MODE === 'true') {
        if (token && token !== '') {
            return {
                id: 'mock-user-123',
                email: 'test@example.com',
                user_metadata: { full_name: 'Test User' },
                app_metadata: { role: 'user' },
                created_at: new Date().toISOString()
            };
        }
        return null;
    }
    
    try {
        const { data: { user }, error } = await supabaseAnonClient.auth.getUser(token);
        
        if (error) {
            console.warn('Failed to get user from token:', error.message);
            return null;
        }
        
        return user;
    } catch (error) {
        console.error('Error getting user from token:', error.message);
        return null;
    }
};

// Health check function
const checkConnection = async () => {
    if (!isSupabaseConfigured) {
        return { connected: false, error: 'Mock mode - Supabase not configured' };
    }
    
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
        console.error('Supabase connection check failed:', error.message);
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