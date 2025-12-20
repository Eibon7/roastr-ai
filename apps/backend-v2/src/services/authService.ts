/**
 * Authentication Service v2
 * 
 * Servicio principal de autenticación usando Supabase Auth.
 * Implementa signup, login, logout, refresh, magic links según SSOT v2.
 */

import { supabase } from '../lib/supabaseClient.js';
import { AuthError, AUTH_ERROR_CODES, mapSupabaseError } from '../utils/authErrorTaxonomy.js';
import { rateLimitService } from './rateLimitService.js';
import { abuseDetectionService } from './abuseDetectionService.js';

export interface SignupParams {
  email: string;
  password: string;
  planId: 'starter' | 'pro' | 'plus';
  metadata?: Record<string, any>;
}

export interface LoginParams {
  email: string;
  password: string;
  ip: string;
}

export interface MagicLinkParams {
  email: string;
  ip: string;
}

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
  email_verified: boolean;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  user: User;
}

export class AuthService {
  /**
   * Registra un nuevo usuario
   */
  async signup(params: SignupParams): Promise<AuthSession> {
    const { email, password, planId, metadata } = params;

    try {
      // Validación básica
      if (!this.isValidEmail(email)) {
        throw new AuthError(
          AUTH_ERROR_CODES.INVALID_CREDENTIALS,
          'Invalid email format'
        );
      }

      if (!this.isValidPassword(password)) {
        throw new AuthError(
          AUTH_ERROR_CODES.INVALID_CREDENTIALS,
          'Password must be at least 8 characters'
        );
      }

      if (!['starter', 'pro', 'plus'].includes(planId)) {
        throw new AuthError(
          AUTH_ERROR_CODES.INVALID_CREDENTIALS,
          'Invalid plan ID'
        );
      }

      // Crear usuario en Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: {
          data: {
            plan_id: planId,
            role: 'user',
            onboarding_state: 'welcome',
            ...metadata
          }
        }
      });

      if (error) {
        throw mapSupabaseError(error);
      }

      if (!data.user || !data.session) {
        throw new AuthError(
          AUTH_ERROR_CODES.ACCOUNT_NOT_FOUND,
          'User creation failed'
        );
      }

      // Crear perfil en profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: data.user.id,
          username: email.split('@')[0],
          language_preference: 'en',
          onboarding_state: 'welcome'
        });

      if (profileError) {
        console.error('Failed to create profile:', profileError);
        // No lanzar error, el usuario ya está creado
      }

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in || 3600,
        expires_at: data.session.expires_at || Date.now() + 3600,
        user: {
          id: data.user.id,
          email: data.user.email!,
          role: (data.user.user_metadata?.role as any) || 'user',
          email_verified: !!data.user.email_confirmed_at,
          created_at: data.user.created_at,
          metadata: data.user.user_metadata
        }
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Inicia sesión con email y password
   */
  async login(params: LoginParams): Promise<AuthSession> {
    const { email, password, ip } = params;

    try {
      // Rate limiting
      const rateLimitResult = rateLimitService.recordAttempt('login', ip);
      if (!rateLimitResult.allowed) {
        const blockedUntil = rateLimitResult.blockedUntil;
        const message = blockedUntil === null
          ? 'Account permanently locked. Contact support.'
          : `Too many login attempts. Try again in ${Math.ceil((blockedUntil - Date.now()) / 60000)} minutes.`;
        
        throw new AuthError(
          AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message
        );
      }

      // Abuse detection
      const abuseResult = abuseDetectionService.recordAttempt(email, ip);
      if (abuseResult.isAbuse) {
        throw new AuthError(
          AUTH_ERROR_CODES.ACCOUNT_LOCKED,
          `Suspicious activity detected: ${abuseResult.patterns.join(', ')}`
        );
      }

      // Autenticación con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password
      });

      if (error) {
        throw mapSupabaseError(error);
      }

      if (!data.user || !data.session) {
        throw new AuthError(
          AUTH_ERROR_CODES.INVALID_CREDENTIALS,
          'Invalid email or password'
        );
      }

      // Verificar email confirmado
      if (!data.user.email_confirmed_at) {
        throw new AuthError(
          AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED,
          'Please verify your email before logging in'
        );
      }

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in || 3600,
        expires_at: data.session.expires_at || Date.now() + 3600,
        user: {
          id: data.user.id,
          email: data.user.email!,
          role: (data.user.user_metadata?.role as any) || 'user',
          email_verified: !!data.user.email_confirmed_at,
          created_at: data.user.created_at,
          metadata: data.user.user_metadata
        }
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Solicita un magic link para login passwordless
   * SOLO permitido para role=user (NUNCA admin/superadmin)
   */
  async requestMagicLink(params: MagicLinkParams): Promise<{ success: boolean; message: string }> {
    const { email, ip } = params;

    try {
      // Rate limiting
      const rateLimitResult = rateLimitService.recordAttempt('magic_link', ip);
      if (!rateLimitResult.allowed) {
        const blockedUntil = rateLimitResult.blockedUntil;
        const message = blockedUntil === null
          ? 'Account permanently locked. Contact support.'
          : `Too many magic link requests. Try again in ${Math.ceil((blockedUntil - Date.now()) / 60000)} minutes.`;
        
        throw new AuthError(
          AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED,
          message
        );
      }

      // Verificar que el usuario existe y es role=user
      const { data: userData, error: userError } = await supabase.auth.admin.getUserByEmail(email.toLowerCase());

      if (userError || !userData.user) {
        // No revelar si el email existe (anti-enumeration)
        return {
          success: true,
          message: 'If this email exists, a magic link has been sent'
        };
      }

      const role = userData.user.user_metadata?.role || 'user';
      if (role === 'admin' || role === 'superadmin') {
        throw new AuthError(
          AUTH_ERROR_CODES.MAGIC_LINK_NOT_ALLOWED,
          'Magic links are not allowed for admin users'
        );
      }

      // Enviar magic link
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: {
          shouldCreateUser: false
        }
      });

      if (error) {
        throw mapSupabaseError(error);
      }

      return {
        success: true,
        message: 'Magic link sent to your email'
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Cierra sesión
   */
  async logout(accessToken: string): Promise<void> {
    try {
      const { error } = await supabase.auth.admin.signOut(accessToken);
      if (error) {
        throw mapSupabaseError(error);
      }
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Refresca el access token
   */
  async refreshSession(refreshToken: string): Promise<AuthSession> {
    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error) {
        throw mapSupabaseError(error);
      }

      if (!data.session || !data.user) {
        throw new AuthError(
          AUTH_ERROR_CODES.TOKEN_INVALID,
          'Invalid refresh token'
        );
      }

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in || 3600,
        expires_at: data.session.expires_at || Date.now() + 3600,
        user: {
          id: data.user.id,
          email: data.user.email!,
          role: (data.user.user_metadata?.role as any) || 'user',
          email_verified: !!data.user.email_confirmed_at,
          created_at: data.user.created_at,
          metadata: data.user.user_metadata
        }
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Obtiene usuario actual desde token
   */
  async getCurrentUser(accessToken: string): Promise<User> {
    try {
      const { data, error } = await supabase.auth.getUser(accessToken);

      if (error) {
        throw mapSupabaseError(error);
      }

      if (!data.user) {
        throw new AuthError(
          AUTH_ERROR_CODES.TOKEN_INVALID,
          'Invalid access token'
        );
      }

      return {
        id: data.user.id,
        email: data.user.email!,
        role: (data.user.user_metadata?.role as any) || 'user',
        email_verified: !!data.user.email_confirmed_at,
        created_at: data.user.created_at,
        metadata: data.user.user_metadata
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Valida formato de email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida fortaleza de password
   */
  private isValidPassword(password: string): boolean {
    return password.length >= 8;
  }
}

// Singleton
export const authService = new AuthService();
