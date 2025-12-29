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
import { createHash } from 'crypto';
import { loadSettings } from '../lib/loadSettings.js';
import { logger } from '../utils/logger.js';
import { trackEvent } from '../lib/analytics.js';

export interface SignupParams {
  email: string;
  password: string;
  planId: string;
  metadata?: Record<string, any>;
}

export interface RegisterParams {
  email: string;
  password: string;
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

export interface PasswordRecoveryParams {
  email: string;
  ip: string;
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'superadmin';
  email_verified: boolean;
  created_at?: string;
  metadata?: Record<string, any>;
}

export class AuthService {
  /**
   * Registro v2 (contract-first)
   *
   * - Identidad: Supabase Auth (email + password)
   * - Anti-enumeration: si el email ya existe, NO se revela (caller debe responder homogéneo)
   * - Perfil mínimo: se intenta crear en `profiles` (best-effort, no bloquea registro)
   */
  async register(params: RegisterParams): Promise<void> {
    const normalizedEmail = this.normalizeEmail(params.email);
    const { password } = params;

    try {
      // Validaciones dentro del try-catch para capturar analytics
      if (!this.isValidEmail(normalizedEmail) || !this.isValidPassword(password)) {
        throw new AuthError(AUTH_ERROR_CODES.INVALID_REQUEST);
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            role: 'user'
          }
        }
      });

      if (error) {
        // Anti-enumeration: si el email ya existe, no revelar (caller responderá success:true).
        if (this.isEmailAlreadyRegisteredError(error)) {
          return;
        }
        throw mapSupabaseError(error);
      }

      // Supabase puede devolver session null si requiere verificación. Aun así, user puede existir.
      if (!data?.user?.id) return;

      // Perfil mínimo (best-effort): NO bloquear si falla.
      const { error: profileError } = await supabase.from('profiles').insert({
        user_id: data.user.id,
        username: normalizedEmail,
        onboarding_state: 'welcome'
      });

      if (profileError) {
        // No loguear email/password. Solo contexto mínimo.
        logger.warn('auth.register.profile_create_failed', {
          userId: data.user.id,
          code: profileError.code,
          message: profileError.message
        });
      }

      // Track successful registration (B3: Register Analytics)
      try {
        trackEvent({
          userId: data.user.id,
          event: 'auth_register_success',
          properties: {
            method: 'email_password',
            profile_created: !profileError
          },
          context: {
            flow: 'auth'
          }
        });
      } catch {
        // Graceful degradation: analytics failure should not crash registration
        logger.warn('analytics.track_failed', { event: 'auth_register_success' });
      }
    } catch (error) {
      // Track failed registration (B3: Register Analytics)
      try {
        trackEvent({
          event: 'auth_register_failed',
          properties: {
            error_slug: error instanceof AuthError ? error.slug : AUTH_ERROR_CODES.UNKNOWN,
            method: 'email_password'
          },
          context: {
            flow: 'auth'
          }
        });
      } catch {
        // Graceful degradation: analytics failure should not crash error handling
        logger.warn('analytics.track_failed', { event: 'auth_register_failed' });
      }

      if (error instanceof AuthError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Registra un nuevo usuario
   */
  async signup(params: SignupParams): Promise<Session> {
    const { email, password, planId, metadata } = params;

    // Validar inputs
    if (!this.isValidEmail(email)) {
      throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS, 'Invalid email format');
    }

    if (!this.isValidPassword(password)) {
      throw new AuthError(
        AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        'Password must be at least 8 characters'
      );
    }

    // TODO: Validar planId contra SSOT
    // Temporal hardcoded para deadline 2025-12-31
    // Referencia: Issue ROA-360
    // Note: starter_trial added as hotfix (pre-existing issue, see CodeRabbit review)
    const validPlans = ['starter_trial', 'starter', 'pro', 'plus'];
    if (!validPlans.includes(planId)) {
      throw new AuthError(
        AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        'Invalid plan ID. Must be one of: starter_trial, starter, pro, plus'
      );
    }

    // ROA-355: Verificar si el email ya existe antes de intentar crear usuario
    const emailExists = await this.checkEmailExists(email);
    if (emailExists) {
      throw new AuthError(
        AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS,
        'An account with this email already exists'
      );
    }

    try {
      // Crear usuario en Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password,
        options: {
          data: {
            role: 'user',
            plan_id: planId,
            ...metadata
          }
        }
      });

      if (error) {
        throw mapSupabaseError(error);
      }

      if (!data.user || !data.session) {
        throw new AuthError(AUTH_ERROR_CODES.INVALID_CREDENTIALS, 'Failed to create user session');
      }

      // Crear perfil en base de datos
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        email: data.user.email,
        plan_id: planId,
        created_at: new Date().toISOString()
      });

      if (profileError) {
        console.error('Failed to create profile:', profileError);
        // No lanzar error, el usuario ya está creado
      }

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at:
          typeof data.session.expires_at === 'number'
            ? data.session.expires_at
            : Math.floor(new Date(data.session.expires_at).getTime() / 1000),
        token_type: data.session.token_type || 'bearer',
        user: {
          id: data.user.id,
          email: data.user.email!,
          role: 'user',
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
  async login(params: LoginParams): Promise<Session> {
    const { email, password, ip } = params;

    // Feature flag check: auth.login.enabled
    try {
      const settings = await loadSettings();
      const loginEnabled = settings?.auth?.login?.enabled ?? true;

      if (!loginEnabled) {
        throw new AuthError(
          AUTH_ERROR_CODES.AUTH_DISABLED,
          'Authentication is currently unavailable.'
        );
      }
    } catch (error) {
      // If SettingsLoader fails, fall back to process.env
      const loginEnabled = process.env.AUTH_LOGIN_ENABLED !== 'false';

      if (!loginEnabled) {
        throw new AuthError(
          AUTH_ERROR_CODES.AUTH_DISABLED,
          'Authentication is currently unavailable.'
        );
      }

      // If it's an AuthError (AUTH_DISABLED), rethrow it
      if (error instanceof AuthError) {
        throw error;
      }
      // Otherwise, continue (settings loader unavailable but auth not explicitly disabled)
    }

    try {
      // Rate limiting
      const rateLimitResult = rateLimitService.recordAttempt('login', ip);
      if (!rateLimitResult.allowed) {
        const blockedUntil = rateLimitResult.blockedUntil;
        const message =
          blockedUntil === null || blockedUntil === undefined
            ? 'Account permanently locked. Contact support.'
            : `Too many login attempts. Try again in ${Math.ceil((blockedUntil - Date.now()) / 60000)} minutes.`;

        throw new AuthError(AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED, message);
      }

      // Abuse detection
      const abuseResult = abuseDetectionService.recordAttempt(email, ip);
      if (abuseResult.isAbuse) {
        // Log patterns server-side for investigation, but don't expose to client
        // PII anonymized for GDPR compliance
        console.error('Abuse detected:', {
          emailHash: this.hashForLog(email),
          ipPrefix: ip.split('.').slice(0, 2).join('.') + '.x.x',
          patterns: abuseResult.patterns
        });
        throw new AuthError(
          AUTH_ERROR_CODES.ACCOUNT_LOCKED,
          'Suspicious activity detected. Please try again later or contact support.'
        );
      }

      // Autenticación con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password
      });

      if (error || !data.session) {
        throw mapSupabaseError(error);
      }

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at:
          typeof data.session.expires_at === 'number'
            ? data.session.expires_at
            : Math.floor(new Date(data.session.expires_at).getTime() / 1000),
        token_type: data.session.token_type || 'bearer',
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
   * Cierra sesión
   */
  async logout(accessToken: string): Promise<void> {
    try {
      if (!accessToken) {
        return;
      }

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
  async refreshSession(refreshToken: string): Promise<Session> {
    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error) {
        throw mapSupabaseError(error);
      }

      if (!data.session || !data.user) {
        throw new AuthError(AUTH_ERROR_CODES.TOKEN_INVALID, 'Invalid refresh token');
      }

      // Calculate expires_at if not provided
      let expires_at: number;
      if (typeof data.session.expires_at === 'number') {
        expires_at = data.session.expires_at;
      } else if (data.session.expires_at) {
        expires_at = Math.floor(new Date(data.session.expires_at).getTime() / 1000);
      } else {
        // If expires_at is undefined, calculate from expires_in
        expires_at = Math.floor(Date.now() / 1000) + (data.session.expires_in || 3600);
      }

      return {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at,
        token_type: data.session.token_type || 'bearer',
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
   * Solicita magic link para login passwordless
   * SOLO permitido para role=user (admin/superadmin no pueden usar magic links)
   */
  async requestMagicLink(params: MagicLinkParams): Promise<{ success: boolean; message: string }> {
    const { email, ip } = params;

    try {
      // Rate limiting
      const rateLimitResult = rateLimitService.recordAttempt('magic_link', ip);
      if (!rateLimitResult.allowed) {
        const blockedUntil = rateLimitResult.blockedUntil;
        const message =
          blockedUntil === null || blockedUntil === undefined
            ? 'Account permanently locked. Contact support.'
            : `Too many magic link requests. Try again in ${Math.ceil((blockedUntil - Date.now()) / 60000)} minutes.`;

        throw new AuthError(AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED, message);
      }

      // Verificar que el usuario existe y es role=user
      // Paginate through users to find matching email (getUserByEmail no existe en Supabase Admin API)
      let user = null;
      let page = 1;
      const perPage = 100;

      while (true) {
        const { data: usersList, error: userError } = await supabase.auth.admin.listUsers({
          page,
          perPage
        });

        if (userError) break;

        user = usersList?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (
          user ||
          !usersList?.users?.length ||
          (usersList.users && usersList.users.length < perPage)
        )
          break;

        page++;
      }

      if (!user) {
        // No revelar si el email existe (anti-enumeration)
        return {
          success: true,
          message: 'If this email exists, a magic link has been sent'
        };
      }

      // Verificar que user y user_metadata existan
      if (!user.user_metadata) {
        return {
          success: true,
          message: 'If this email exists, a magic link has been sent'
        };
      }

      const role = user.user_metadata.role || 'user';
      if (role === 'admin' || role === 'superadmin') {
        // Return same message as non-existent user (anti-enumeration)
        return {
          success: true,
          message: 'If this email exists, a magic link has been sent'
        };
      }

      // Enviar magic link
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase(),
        options: {
          emailRedirectTo:
            process.env.SUPABASE_REDIRECT_URL || 'http://localhost:3000/auth/callback'
        }
      });

      if (error) {
        throw mapSupabaseError(error);
      }

      return {
        success: true,
        message: 'Magic link sent successfully'
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw mapSupabaseError(error);
    }
  }

  /**
   * Solicita un email de recuperación de contraseña
   * SOLO permitido para role=user (admin/superadmin no pueden usar password recovery)
   */
  async requestPasswordRecovery(
    params: PasswordRecoveryParams
  ): Promise<{ success: boolean; message: string }> {
    const { email, ip } = params;

    try {
      // Rate limiting
      const rateLimitResult = rateLimitService.recordAttempt('password_recovery', ip);
      if (!rateLimitResult.allowed) {
        const blockedUntil = rateLimitResult.blockedUntil;
        const message =
          blockedUntil === null || blockedUntil === undefined
            ? 'Account permanently locked. Contact support.'
            : `Too many password recovery requests. Try again in ${Math.ceil((blockedUntil - Date.now()) / 60000)} minutes.`;

        throw new AuthError(AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED, message);
      }

      // Verificar que el usuario existe y es role=user
      let user = null;
      let page = 1;
      const perPage = 100;

      while (true) {
        const { data: usersList, error: userError } = await supabase.auth.admin.listUsers({
          page,
          perPage
        });

        if (userError) break;

        user = usersList?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (
          user ||
          !usersList?.users?.length ||
          (usersList.users && usersList.users.length < perPage)
        )
          break;

        page++;
      }

      if (!user) {
        // No revelar si el email existe (anti-enumeration)
        return {
          success: true,
          message: 'If this email exists, a password recovery link has been sent'
        };
      }

      if (!user.user_metadata) {
        return {
          success: true,
          message: 'If this email exists, a password recovery link has been sent'
        };
      }

      const role = user.user_metadata.role || 'user';
      if (role === 'admin' || role === 'superadmin') {
        // Return same message as non-existent user (anti-enumeration)
        return {
          success: true,
          message: 'If this email exists, a password recovery link has been sent'
        };
      }

      // Enviar email de recuperación
      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
        redirectTo: process.env.SUPABASE_REDIRECT_URL || 'http://localhost:3000/auth/callback'
      });

      if (error) {
        throw mapSupabaseError(error);
      }

      return {
        success: true,
        message: 'Password recovery link sent successfully'
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
        throw new AuthError(AUTH_ERROR_CODES.TOKEN_INVALID, 'Invalid access token');
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
   * Valida formato de password
   */
  private isValidPassword(password: string): boolean {
    return password.length >= 8;
  }

  /**
   * Verifica si un email ya existe en la base de datos (ROA-355)
   *
   * Usa Supabase Admin API para listar usuarios y buscar el email.
   * Soporta paginación para bases de datos grandes.
   * Comparación case-insensitive.
   *
   * @param email - Email a verificar
   * @returns true si el email existe, false si no existe o si hay error (fallback)
   */
  private async checkEmailExists(email: string): Promise<boolean> {
    // Feature flag check: auth.signup.checkEmailExists.enabled
    try {
      const settings = await loadSettings();
      const checkEnabled = settings?.auth?.signup?.checkEmailExists?.enabled ?? true;

      if (!checkEnabled) {
        return false; // Skip check if feature disabled
      }
    } catch (error) {
      // If SettingsLoader fails, fall back to process.env
      const checkEnabled = process.env.AUTH_CHECK_EMAIL_EXISTS_ENABLED !== 'false';

      if (!checkEnabled) {
        return false;
      }

      // If it's an AuthError, rethrow it
      if (error instanceof AuthError) {
        throw error;
      }
      // Otherwise, continue (settings loader unavailable but feature not explicitly disabled)
    }

    try {
      let page = 1;
      const perPage = 100;
      const normalizedEmail = email.toLowerCase();

      while (true) {
        const { data: usersList, error: userError } = await supabase.auth.admin.listUsers({
          page,
          perPage
        });

        if (userError) {
          // Log error pero no bloquear signup (fallback behavior)
          logger.error('Error checking email existence:', userError);
          return false; // Assume not exists to not block signup
        }

        // Buscar email en la lista de usuarios (case-insensitive)
        const user = usersList?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);

        if (user) {
          return true;
        }

        // Si no hay más usuarios o la lista es menor que perPage, terminamos
        if (!usersList?.users?.length || (usersList.users && usersList.users.length < perPage)) {
          return false;
        }
        page++;
      }
    } catch (error) {
      // Log error pero no bloquear signup (fallback behavior)
      logger.error('Unexpected error checking email existence:', error);
      return false; // Assume not exists to not block signup
    }
  }

  /**
   * Normaliza email (lowercase, trim)
   */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Detecta si un error de Supabase indica que el email ya está registrado
   */
  private isEmailAlreadyRegisteredError(error: unknown): boolean {
    const message = (error as any)?.message?.toString?.() || '';
    const lowerMessage = message.toLowerCase();
    return (
      lowerMessage.includes('already registered') ||
      lowerMessage.includes('already exists') ||
      lowerMessage.includes('email address already') ||
      lowerMessage.includes('duplicate')
    );
  }

  /**
   * Hash para logging (GDPR compliance)
   */
  private hashForLog(value: string): string {
    return createHash('sha256').update(value.toLowerCase()).digest('hex').substring(0, 12);
  }
}

// Singleton
export const authService = new AuthService();
