import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, authHelpers } from '../lib/supabaseClient';
import { isMockModeEnabled } from '../lib/mockMode';
import apiClient from '../lib/api';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [mockMode] = useState(isMockModeEnabled());

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (session) {
          setSession(session);
          setUser(session.user);
          
          // Get additional user data from API
          try {
            const additionalUserData = await authHelpers.getUserFromAPI(session.access_token);
            if (mounted) {
              setUserData(additionalUserData);
            }
          } catch (error) {
            console.error('Error fetching user data from API:', error);
            // In case of API error, create basic user data from session
            if (mounted) {
              setUserData({
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.name || 'User',
                plan: mockMode ? 'pro' : 'free',
                rqcEnabled: mockMode ? true : false,
                avatar: session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`,
                joinedAt: session.user.created_at,
                lastActive: new Date().toISOString(),
              });
            }
          }
        } else {
          setSession(null);
          setUser(null);
          setUserData(null);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setUserData(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('Auth state change:', event, session ? 'session present' : 'no session');
      
      setSession(session);
      setUser(session?.user ?? null);

      if (session) {
        try {
          const additionalUserData = await authHelpers.getUserFromAPI(session.access_token);
          if (mounted) {
            setUserData(additionalUserData);
          }
        } catch (error) {
          console.error('Error fetching user data from API:', error);
          // Fallback user data
          if (mounted) {
            setUserData({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.name || 'User',
              plan: mockMode ? 'pro' : 'free',
              rqcEnabled: mockMode ? true : false,
              avatar: session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`,
              joinedAt: session.user.created_at,
              lastActive: new Date().toISOString(),
            });
          }
        }
      } else {
        if (mounted) {
          setUserData(null);
        }
      }

      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [mockMode]);

  const signUp = async (email, password, name) => {
    setLoading(true);
    try {
      const data = await authHelpers.signUp(email, password, name);
      return data;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    setLoading(true);
    try {
      const data = await authHelpers.signIn(email, password);
      return data;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithMagicLink = async (email) => {
    setLoading(true);
    try {
      const data = await authHelpers.signInWithMagicLink(email);
      return data;
    } catch (error) {
      console.error('Magic link sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithMagicLink = async (email, name) => {
    setLoading(true);
    try {
      const data = await authHelpers.signUpWithMagicLink(email, name);
      return data;
    } catch (error) {
      console.error('Magic link sign up error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email) => {
    try {
      const data = await authHelpers.resetPassword(email);
      return data;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await authHelpers.signOut();
      // State will be updated via the onAuthStateChange listener
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshUserData = async () => {
    if (!session) return;

    try {
      const additionalUserData = await authHelpers.getUserFromAPI(session.access_token);
      setUserData(additionalUserData);
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const value = {
    // Auth state
    user,
    session,
    userData,
    loading,
    mockMode,
    
    // Auth actions
    signUp,
    signIn,
    signInWithMagicLink,
    signUpWithMagicLink,
    resetPassword,
    signOut,
    refreshUserData,
    
    // Helper getters
    isAuthenticated: !!user,
    isPro: userData?.plan === 'pro' || userData?.plan === 'enterprise',
    hasRQC: userData?.rqcEnabled === true,
    isAdmin: userData?.is_admin === true,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};