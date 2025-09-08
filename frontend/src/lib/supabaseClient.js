import { createClient } from '@supabase/supabase-js';
import { isMockModeEnabled, logMockModeStatus, createMockSupabaseClient } from './mockMode';

// Log mock mode status in development
logMockModeStatus();

/**
 * Mock Supabase Client
 * Simulates Supabase auth functionality using localStorage
 */
class MockSupabaseClient {
  constructor() {
    this.MOCK_SESSION_KEY = 'mock_supabase_session';
    this.MOCK_USER_KEY = 'mock_supabase_user';
    this.SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    
    // Mock user data
    this.mockUser = {
      id: 'mock_user_123',
      email: 'user@roastr.ai',
      user_metadata: {
        name: 'Demo User',
        avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MockUser',
      },
      app_metadata: {
        plan: 'pro',
        rqcEnabled: true,
      },
      created_at: '2024-01-15T10:00:00Z',
      updated_at: new Date().toISOString(),
    };
    
    this.auth = {
      signUp: this.mockSignUp.bind(this),
      signInWithPassword: this.mockSignInWithPassword.bind(this),
      signInWithOtp: this.mockSignInWithOtp.bind(this),
      signOut: this.mockSignOut.bind(this),
      getUser: this.mockGetUser.bind(this),
      getSession: this.mockGetSession.bind(this),
      onAuthStateChange: this.mockOnAuthStateChange.bind(this),
      resetPasswordForEmail: this.mockResetPassword.bind(this),
    };
    
    this._authCallbacks = new Set();
    this._initializeMockSession();
  }
  
  _initializeMockSession() {
    // Check if there's a stored session
    const storedSession = localStorage.getItem(this.MOCK_SESSION_KEY);
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        const now = Date.now();
        
        // Check if session is expired
        if (now > session.expires_at) {
          localStorage.removeItem(this.MOCK_SESSION_KEY);
          localStorage.removeItem(this.MOCK_USER_KEY);
        }
      } catch (error) {
        console.warn('Failed to parse mock session, clearing:', error);
        localStorage.removeItem(this.MOCK_SESSION_KEY);
        localStorage.removeItem(this.MOCK_USER_KEY);
      }
    }
  }
  
  _createMockSession(user) {
    const now = Date.now();
    const session = {
      access_token: `mock_token_${Date.now()}`,
      refresh_token: `mock_refresh_${Date.now()}`,
      expires_at: now + this.SESSION_DURATION,
      expires_in: this.SESSION_DURATION / 1000,
      token_type: 'bearer',
      user: user,
    };
    
    localStorage.setItem(this.MOCK_SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(this.MOCK_USER_KEY, JSON.stringify(user));
    
    return session;
  }
  
  _notifyAuthChange(event, session) {
    this._authCallbacks.forEach(callback => {
      try {
        callback(event, session);
      } catch (error) {
        console.error('Error in auth callback:', error);
      }
    });
  }
  
  async mockSignUp({ email, password, options = {} }) {
    console.log('🎭 Mock SignUp:', { email, options });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const user = {
      ...this.mockUser,
      email,
      user_metadata: {
        ...this.mockUser.user_metadata,
        ...options.data,
      },
    };
    
    const session = this._createMockSession(user);
    this._notifyAuthChange('SIGNED_IN', session);
    
    return { data: { user, session }, error: null };
  }
  
  async mockSignInWithPassword({ email, password }) {
    console.log('🎭 Mock SignIn:', { email });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Simple validation for demo
    if (!email || !password) {
      return {
        data: { user: null, session: null },
        error: new Error('Email and password are required'),
      };
    }
    
    const user = { ...this.mockUser, email };
    const session = this._createMockSession(user);
    this._notifyAuthChange('SIGNED_IN', session);
    
    return { data: { user, session }, error: null };
  }
  
  async mockSignInWithOtp({ email, options = {} }) {
    console.log('🎭 Mock SignIn with OTP:', { email, options });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // For magic link, we simulate immediate success
    const user = {
      ...this.mockUser,
      email,
      user_metadata: {
        ...this.mockUser.user_metadata,
        ...options.data,
      },
    };
    
    const session = this._createMockSession(user);
    this._notifyAuthChange('SIGNED_IN', session);
    
    return { data: { user, session }, error: null };
  }
  
  async mockSignOut() {
    console.log('🎭 Mock SignOut');
    
    localStorage.removeItem(this.MOCK_SESSION_KEY);
    localStorage.removeItem(this.MOCK_USER_KEY);
    
    this._notifyAuthChange('SIGNED_OUT', null);
    
    return { error: null };
  }
  
  async mockGetUser() {
    const storedUser = localStorage.getItem(this.MOCK_USER_KEY);
    const storedSession = localStorage.getItem(this.MOCK_SESSION_KEY);
    
    if (!storedUser || !storedSession) {
      return { data: { user: null }, error: null };
    }
    
    try {
      const session = JSON.parse(storedSession);
      const now = Date.now();
      
      // Check if session is expired
      if (now > session.expires_at) {
        localStorage.removeItem(this.MOCK_SESSION_KEY);
        localStorage.removeItem(this.MOCK_USER_KEY);
        return { data: { user: null }, error: null };
      }
      
      const user = JSON.parse(storedUser);
      return { data: { user }, error: null };
    } catch (error) {
      console.error('Error getting mock user:', error);
      return { data: { user: null }, error };
    }
  }
  
  async mockGetSession() {
    const storedSession = localStorage.getItem(this.MOCK_SESSION_KEY);
    
    if (!storedSession) {
      return { data: { session: null }, error: null };
    }
    
    try {
      const session = JSON.parse(storedSession);
      const now = Date.now();
      
      // Check if session is expired
      if (now > session.expires_at) {
        localStorage.removeItem(this.MOCK_SESSION_KEY);
        localStorage.removeItem(this.MOCK_USER_KEY);
        return { data: { session: null }, error: null };
      }
      
      return { data: { session }, error: null };
    } catch (error) {
      console.error('Error getting mock session:', error);
      return { data: { session: null }, error };
    }
  }
  
  mockOnAuthStateChange(callback) {
    this._authCallbacks.add(callback);
    
    // Immediately call with current state
    this.mockGetSession().then(({ data: { session } }) => {
      if (session) {
        callback('SIGNED_IN', session);
      } else {
        callback('SIGNED_OUT', null);
      }
    });
    
    // Return unsubscribe function
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this._authCallbacks.delete(callback);
          },
        },
      },
    };
  }
  
  async mockResetPassword(email, options = {}) {
    console.log('🎭 Mock Reset Password:', { email, options });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { data: {}, error: null };
  }
}

/**
 * Create Supabase Client Factory
 * Returns either a real Supabase client or a mock client based on environment
 */
function createSupabaseClient() {
  if (isMockModeEnabled()) {
    console.log('🎭 Creating Mock Supabase Client');
    return new MockSupabaseClient();
  }
  
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables, but mock mode is disabled');
    throw new Error(
      'Missing Supabase environment variables. Please check REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your .env file.'
    );
  }
  
  console.log('🔗 Creating Real Supabase Client');
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

// Export the factory function for testing
export { createSupabaseClient };

// Create the client instance
export const supabase = createSupabaseClient();

// Auth helper functions that work with both real and mock clients
export const authHelpers = {
  // Sign up with email and password
  async signUp(email, password, name) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || null,
        },
      },
    });

    if (error) throw error;
    return data;
  },

  // Sign in with email and password
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  // Sign in with magic link
  async signInWithMagicLink(email) {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
    return data;
  },

  // Sign up with magic link
  async signUpWithMagicLink(email, name) {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: {
          name: name || null,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) throw error;
    return data;
  },

  // Reset password
  async resetPassword(email) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) throw error;
    return data;
  },

  // Sign out
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Get current user
  async getCurrentUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) throw error;
    return user;
  },

  // Get current session
  async getCurrentSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;
    return session;
  },

  // Listen to auth changes
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },

  // Get user data from backend API (works in both modes)
  async getUserFromAPI(accessToken) {
    // In mock mode, return mock user data directly
    if (isMockModeEnabled()) {
      return {
        id: 'mock_user_123',
        email: 'user@roastr.ai',
        name: 'Demo User',
        plan: 'pro',
        rqcEnabled: true,
        is_admin: false, // Mock user is not admin by default
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MockUser',
        joinedAt: '2024-01-15T10:00:00Z',
        lastActive: new Date().toISOString(),
      };
    }
    
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.data; // Return the user data from response.data
  },
};

export default supabase;