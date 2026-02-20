import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { setUserId, setUserProperties, reset } from './analytics-identity';
import {
  getAccessToken,
  setTokens,
  clearTokens
} from './auth/tokenStorage';

interface User {
  id: string;
  email: string;
  name?: string;
  is_admin?: boolean;
  organization_id?: string;
  plan?: string;
  lo_que_me_define_encrypted?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSupabaseUser(supabaseUser: any): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    name: supabaseUser.user_metadata?.name,
    is_admin: supabaseUser.user_metadata?.is_admin ?? false,
    organization_id: supabaseUser.user_metadata?.organization_id,
    plan: supabaseUser.user_metadata?.plan ?? 'free',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Demo mode shortcut
    const token = getAccessToken();
    if (token && token.startsWith('demo-token-')) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try { setUser(JSON.parse(storedUser)); } catch { /* ignore */ }
      }
      setLoading(false);
      return;
    }

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          const mapped = mapSupabaseUser(session.user);
          setUser(mapped);
          localStorage.setItem('user', JSON.stringify(mapped));
          if (session.access_token && session.refresh_token) {
            setTokens(session.access_token, session.refresh_token);
          }
        } else {
          setUser(null);
          localStorage.removeItem('user');
          clearTokens();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const mapped = mapSupabaseUser(session.user);
        setUser(mapped);
        localStorage.setItem('user', JSON.stringify(mapped));
        if (session.access_token && session.refresh_token) {
          setTokens(session.access_token, session.refresh_token);
        }
      } else {
        clearTokens();
        setUser(null);
      }
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(mapSupabaseAuthError(error.message));
    }

    if (!data.session || !data.user) {
      throw new Error('No se pudo iniciar sesión. Inténtalo de nuevo.');
    }

    const mapped = mapSupabaseUser(data.user);
    setUser(mapped);
    localStorage.setItem('user', JSON.stringify(mapped));
    setTokens(data.session.access_token, data.session.refresh_token);

    setUserId(mapped.id);
    setUserProperties({
      plan: mapped.plan || 'free',
      role: mapped.is_admin ? 'admin' : 'user',
      is_admin: mapped.is_admin || false,
      auth_provider: 'email_password',
      locale: navigator.language?.split('-')[0] || 'en',
    });
  };

  const logout = async () => {
    setUserId(undefined);
    reset();
    clearTokens();
    localStorage.removeItem('user');
    setUser(null);

    try {
      await supabase.auth.signOut();
    } catch {
      // Already cleared local state
    }
  };

  const refreshUser = async () => {
    await checkSession();
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.is_admin === true,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function mapSupabaseAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'El email o la contraseña no son correctos';
  }
  if (lower.includes('email not confirmed')) {
    return 'Tu email aún no ha sido verificado. Revisa tu bandeja de entrada.';
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Demasiados intentos. Por favor espera unos minutos.';
  }
  if (lower.includes('user not found')) {
    return 'El email o la contraseña no son correctos';
  }
  if (lower.includes('email already registered') || lower.includes('already been registered')) {
    return 'No se pudo completar el registro. Verifica tus datos.';
  }
  if (lower.includes('password')) {
    return 'La contraseña no cumple los requisitos mínimos de seguridad.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión a internet.';
  }
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
