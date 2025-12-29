/**
 * Audit Service v2
 *
 * Servicio para registrar eventos de seguridad y auth en admin_audit_logs.
 * Parte del sistema A3 (Authentication, Authorization, Audit).
 *
 * Issue: ROA-407 - A3 Auth Policy Wiring v2
 */

import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Severity levels para eventos de audit
 */
export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Tipos de acciones auditables
 */
export type AuditActionType =
  | 'auth.login.success'
  | 'auth.login.failed'
  | 'auth.logout'
  | 'auth.register.success'
  | 'auth.register.failed'
  | 'auth.token.refresh'
  | 'auth.magic_link.request'
  | 'auth.magic_link.used'
  | 'auth.password.changed'
  | 'auth.email.verified'
  | 'authz.role.changed'
  | 'authz.permission.denied'
  | 'policy.rate_limit.hit'
  | 'policy.blocked'
  | 'policy.invalid_request'
  | 'session.expired'
  | 'session.revoked'
  | 'token.expired'
  | 'token.invalid';

/**
 * Evento de audit a registrar
 */
export interface AuditEvent {
  action_type: AuditActionType;
  resource_type: string;
  resource_id?: string | null;
  admin_user_id?: string | null;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  description?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  severity: AuditSeverity;
  metadata?: Record<string, unknown>;
}

/**
 * Resultado de operación de audit
 */
interface AuditResult {
  success: boolean;
  event_id?: string;
  error?: string;
}

/**
 * Servicio de Audit para eventos de seguridad
 */
class AuditService {
  /**
   * Registra un evento de audit en la base de datos
   */
  async logEvent(event: AuditEvent): Promise<AuditResult> {
    try {
      // Validar campos requeridos
      if (!event.action_type || !event.resource_type) {
        logger.error('AuditService: Missing required fields', {
          action_type: event.action_type,
          resource_type: event.resource_type
        });
        return { success: false, error: 'Missing required fields' };
      }

      // Preparar datos para inserción
      const auditData = {
        admin_user_id: event.admin_user_id || null,
        action_type: event.action_type,
        resource_type: event.resource_type,
        resource_id: event.resource_id || null,
        old_value: event.old_value || null,
        new_value: event.new_value || null,
        description: event.description || null,
        ip_address: event.ip_address || null,
        user_agent: event.user_agent || null
      };

      // Insertar en admin_audit_logs
      const { data, error } = await supabaseAdmin
        .from('admin_audit_logs')
        .insert(auditData)
        .select('id')
        .single();

      if (error) {
        logger.error('AuditService: Failed to insert audit log', {
          error: error.message,
          action_type: event.action_type,
          severity: event.severity
        });
        return { success: false, error: error.message };
      }

      // Log interno para troubleshooting
      logger.info('AuditService: Event logged', {
        event_id: data.id,
        action_type: event.action_type,
        severity: event.severity,
        resource_type: event.resource_type
      });

      return { success: true, event_id: data.id };
    } catch (error) {
      logger.error('AuditService: Unexpected error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        action_type: event.action_type
      });
      return { success: false, error: 'Unexpected error' };
    }
  }

  /**
   * Registra login exitoso
   */
  async logLoginSuccess(userId: string, ip: string | null, userAgent: string | null): Promise<void> {
    await this.logEvent({
      action_type: 'auth.login.success',
      resource_type: 'auth',
      resource_id: userId,
      admin_user_id: userId,
      description: 'User logged in successfully',
      ip_address: ip,
      user_agent: userAgent,
      severity: 'low'
    });
  }

  /**
   * Registra intento de login fallido
   */
  async logLoginFailed(email: string, reason: string, ip: string | null, userAgent: string | null): Promise<void> {
    await this.logEvent({
      action_type: 'auth.login.failed',
      resource_type: 'auth',
      resource_id: email,
      description: `Login failed: ${reason}`,
      ip_address: ip,
      user_agent: userAgent,
      severity: 'medium',
      metadata: { reason }
    });
  }

  /**
   * Registra logout
   */
  async logLogout(userId: string, ip: string | null): Promise<void> {
    await this.logEvent({
      action_type: 'auth.logout',
      resource_type: 'auth',
      resource_id: userId,
      admin_user_id: userId,
      description: 'User logged out',
      ip_address: ip,
      severity: 'low'
    });
  }

  /**
   * Registra registro exitoso
   */
  async logRegisterSuccess(userId: string, email: string, ip: string | null, userAgent: string | null): Promise<void> {
    await this.logEvent({
      action_type: 'auth.register.success',
      resource_type: 'auth',
      resource_id: userId,
      admin_user_id: userId,
      description: `New user registered: ${email}`,
      ip_address: ip,
      user_agent: userAgent,
      severity: 'low',
      metadata: { email }
    });
  }

  /**
   * Registra intento de registro fallido
   */
  async logRegisterFailed(email: string, reason: string, ip: string | null, userAgent: string | null): Promise<void> {
    await this.logEvent({
      action_type: 'auth.register.failed',
      resource_type: 'auth',
      resource_id: email,
      description: `Registration failed: ${reason}`,
      ip_address: ip,
      user_agent: userAgent,
      severity: 'medium',
      metadata: { reason }
    });
  }

  /**
   * Registra token refresh
   */
  async logTokenRefresh(userId: string, ip: string | null): Promise<void> {
    await this.logEvent({
      action_type: 'auth.token.refresh',
      resource_type: 'auth',
      resource_id: userId,
      admin_user_id: userId,
      description: 'Token refreshed',
      ip_address: ip,
      severity: 'low'
    });
  }

  /**
   * Registra solicitud de magic link
   */
  async logMagicLinkRequest(email: string, ip: string | null, userAgent: string | null): Promise<void> {
    await this.logEvent({
      action_type: 'auth.magic_link.request',
      resource_type: 'auth',
      resource_id: email,
      description: `Magic link requested for: ${email}`,
      ip_address: ip,
      user_agent: userAgent,
      severity: 'medium',
      metadata: { email }
    });
  }

  /**
   * Registra violación de política (rate limit)
   */
  async logRateLimitHit(endpoint: string, userId: string | null, ip: string | null): Promise<void> {
    await this.logEvent({
      action_type: 'policy.rate_limit.hit',
      resource_type: 'policy',
      resource_id: endpoint,
      admin_user_id: userId || null,
      description: `Rate limit exceeded for endpoint: ${endpoint}`,
      ip_address: ip,
      severity: 'high',
      metadata: { endpoint, userId, ip }
    });
  }

  /**
   * Registra violación de política (blocked)
   */
  async logPolicyBlocked(policy: string, userId: string | null, reason: string, ip: string | null): Promise<void> {
    await this.logEvent({
      action_type: 'policy.blocked',
      resource_type: 'policy',
      resource_id: policy,
      admin_user_id: userId || null,
      description: `Policy blocked: ${policy} - ${reason}`,
      ip_address: ip,
      severity: 'critical',
      metadata: { policy, reason }
    });
  }

  /**
   * Registra request inválido
   */
  async logInvalidRequest(endpoint: string, userId: string | null, reason: string, ip: string | null): Promise<void> {
    await this.logEvent({
      action_type: 'policy.invalid_request',
      resource_type: 'policy',
      resource_id: endpoint,
      admin_user_id: userId || null,
      description: `Invalid request to ${endpoint}: ${reason}`,
      ip_address: ip,
      severity: 'medium',
      metadata: { endpoint, reason }
    });
  }

  /**
   * Registra denegación de permisos
   */
  async logPermissionDenied(userId: string, resource: string, action: string, ip: string | null): Promise<void> {
    await this.logEvent({
      action_type: 'authz.permission.denied',
      resource_type: 'authz',
      resource_id: resource,
      admin_user_id: userId,
      description: `Permission denied for ${action} on ${resource}`,
      ip_address: ip,
      severity: 'high',
      metadata: { resource, action }
    });
  }

  /**
   * Registra cambio de rol
   */
  async logRoleChanged(
    userId: string,
    targetUserId: string,
    oldRole: string,
    newRole: string,
    ip: string | null
  ): Promise<void> {
    await this.logEvent({
      action_type: 'authz.role.changed',
      resource_type: 'authz',
      resource_id: targetUserId,
      admin_user_id: userId,
      old_value: { role: oldRole },
      new_value: { role: newRole },
      description: `Role changed from ${oldRole} to ${newRole}`,
      ip_address: ip,
      severity: 'critical',
      metadata: { targetUserId, oldRole, newRole }
    });
  }
}

/**
 * Instancia singleton del servicio de audit
 */
export const auditService = new AuditService();

