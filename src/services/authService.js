/**
 * AuthService
 * Centralizes authentication and user account flows around Supabase auth and
 * our application database (users, organizations, subscriptions, limits).
 *
 * All methods are asynchronous, log meaningful events, and throw on failure
 * so that callers can handle errors uniformly in routes and CLIs.
 */
const { supabaseServiceClient, supabaseAnonClient, createUserClient } = require('../config/supabase');
const { logger } = require('../utils/logger');
const crypto = require('crypto');
const { getPlanFeatures } = require('./planService');
const { isChangeAllowed } = require('./planValidation');
const auditService = require('./auditService');
const { applyPlanLimits } = require('./subscriptionService');
const passwordHistoryService = require('./passwordHistoryService');
const planLimitsService = require('./planLimitsService');

class AuthService {
    
    /**
     * Sign up a new user with email and password.
     * @param {{ email: string, password: string, name?: string }} params Credentials and optional name.
     * @returns {Promise<{ user: import('@supabase/supabase-js').User, session: any, profile: any }>}
     * @throws {Error} If auth creation or user profile insertion fails.
     */
    async signUp({ email, password, name }) {
        try {
            // Create auth user
            const { data: authData, error: authError } = await supabaseAnonClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name || null
                    }
                }
            });

            if (authError) {
                throw new Error(`Signup failed: ${authError.message}`);
            }

            if (!authData.user) {
                throw new Error('User creation failed');
            }

            // Create user record in users table
            const { data: userData, error: userError } = await supabaseServiceClient
                .from('users')
                .insert({
                    id: authData.user.id,
                    email: authData.user.email,
                    name: name || null,
                    plan: 'free',
                    is_admin: false
                })
                .select()
                .single();

            if (userError) {
                logger.error('Failed to create user record:', userError.message);
                // Try to cleanup auth user if possible
                await supabaseServiceClient.auth.admin.deleteUser(authData.user.id);
                throw new Error(`Failed to create user profile: ${userError.message}`);
            }

            logger.info('User signed up successfully:', { 
                userId: authData.user.id, 
                email: authData.user.email 
            });

            return {
                user: authData.user,
                session: authData.session,
                profile: userData
            };

        } catch (error) {
            logger.error('Signup error:', error.message);
            throw error;
        }
    }

    /**
     * Sign up with magic link.
     * @param {{ email: string, name?: string }} params Email and optional display name.
     * @returns {Promise<{ message: string, email: string }>}
     * @throws {Error} If sending the magic link fails.
     */
    async signUpWithMagicLink({ email, name }) {
        try {
            const { data, error } = await supabaseAnonClient.auth.signInWithOtp({
                email,
                options: {
                    data: {
                        name: name || null
                    }
                }
            });

            if (error) {
                throw new Error(`Magic link signup failed: ${error.message}`);
            }

            logger.info('Magic link sent for signup:', { email });
            
            return { 
                message: 'Magic link sent to your email',
                email 
            };

        } catch (error) {
            logger.error('Magic link signup error:', error.message);
            throw error;
        }
    }

    /**
     * Sign in with email and password.
     * Also fetches the user profile from the `users` table.
     * @param {{ email: string, password: string }} params Credentials.
     * @returns {Promise<{ user: any, session: any, profile: any | null }>}
     * @throws {Error} If authentication fails.
     */
    async signIn({ email, password }) {
        try {
            const { data, error } = await supabaseAnonClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                throw new Error(`Sign in failed: ${error.message}`);
            }

            // Get user profile
            const userClient = createUserClient(data.session.access_token);
            const { data: profile, error: profileError } = await userClient
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileError) {
                logger.warn('Failed to fetch user profile:', profileError.message);
            }

            logger.info('User signed in successfully:', { 
                userId: data.user.id, 
                email: data.user.email 
            });

            return {
                user: data.user,
                session: data.session,
                profile
            };

        } catch (error) {
            logger.error('Sign in error:', error.message);
            throw error;
        }
    }

    /**
     * Sign in with magic link.
     * Sends a sign‑in magic link to the specified email.
     * @param {string} email Account email address.
     * @returns {Promise<{ message: string, email: string }>}
     * @throws {Error} If sending the magic link fails.
     */
    async signInWithMagicLink(email) {
        try {
            const { data, error } = await supabaseAnonClient.auth.signInWithOtp({
                email
            });

            if (error) {
                throw new Error(`Magic link sign in failed: ${error.message}`);
            }

            logger.info('Magic link sent for sign in:', { email });
            
            return { 
                message: 'Magic link sent to your email',
                email 
            };

        } catch (error) {
            logger.error('Magic link sign in error:', error.message);
            throw error;
        }
    }

    /**
     * Sign out the current user.
     * @param {string} accessToken User access token.
     * @returns {Promise<{ message: string }>}
     * @throws {Error} If sign out fails.
     */
    async signOut(accessToken) {
        try {
            const userClient = createUserClient(accessToken);
            const { error } = await userClient.auth.signOut();

            if (error) {
                throw new Error(`Sign out failed: ${error.message}`);
            }

            logger.info('User signed out successfully');
            return { message: 'Signed out successfully' };

        } catch (error) {
            logger.error('Sign out error:', error.message);
            throw error;
        }
    }

    /**
     * Get current user profile and related organization/integrations.
     * @param {string} accessToken Valid access token for the user.
     * @returns {Promise<any>} Profile object including `integrations`.
     * @throws {Error} If token is invalid or profile cannot be fetched.
     */
    async getCurrentUser(accessToken) {
        try {
            const userClient = createUserClient(accessToken);
            
            // Get auth user
            const { data: { user }, error: authError } = await userClient.auth.getUser();
            
            if (authError || !user) {
                throw new Error('Invalid or expired token');
            }

            // Get user profile with organization
            const { data: profile, error: profileError } = await userClient
                .from('users')
                .select(`
                    *,
                    organizations!owner_id (
                        id, name, slug, plan_id, monthly_responses_limit, 
                        monthly_responses_used, subscription_status
                    )
                `)
                .eq('id', user.id)
                .single();

            if (profileError) {
                logger.error('Failed to fetch user profile:', profileError.message);
                throw new Error('Failed to fetch user profile');
            }

            // Get user's integrations
            const { data: integrations, error: integrationsError } = await userClient
                .from('integration_configs')
                .select('platform, enabled, created_at')
                .eq('organization_id', profile.organizations[0].id);

            if (integrationsError) {
                logger.warn('Failed to fetch user integrations:', integrationsError.message);
            }

            return {
                ...profile,
                integrations: integrations || []
            };

        } catch (error) {
            logger.error('Get current user error:', error.message);
            throw error;
        }
    }

    /**
     * Send password reset email.
     * @param {string} email Account email address.
     * @returns {Promise<{ message: string, email: string }>}
     * @throws {Error} If sending the reset email fails.
     */
    async resetPassword(email) {
        try {
            const { data, error } = await supabaseAnonClient.auth.resetPasswordForEmail(email);

            if (error) {
                throw new Error(`Password reset failed: ${error.message}`);
            }

            logger.info('Password reset email sent:', { email });
            
            return { 
                message: 'Password reset email sent',
                email 
            };

        } catch (error) {
            logger.error('Password reset error:', error.message);
            throw error;
        }
    }

    /**
    * Update user profile fields.
    * @param {string} accessToken User access token.
    * @param {Record<string, any>} updates Partial update object for `users`.
    * @returns {Promise<any>} Updated profile row.
    * @throws {Error} If authentication or update fails.
    */
    async updateProfile(accessToken, updates) {
        try {
            const userClient = createUserClient(accessToken);
            
            // Get current user
            const { data: { user }, error: authError } = await userClient.auth.getUser();
            
            if (authError || !user) {
                throw new Error('Invalid or expired token');
            }

            // Update user profile
            const { data, error } = await userClient
                .from('users')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();

            if (error) {
                throw new Error(`Profile update failed: ${error.message}`);
            }

            logger.info('User profile updated:', { userId: user.id, updates: Object.keys(updates) });
            
            return data;

        } catch (error) {
            logger.error('Update profile error:', error.message);
            throw error;
        }
    }

    /**
     * Update password with access token.
     * @param {string} accessToken User access token.
     * @param {string} newPassword New password to set.
     * @returns {Promise<{ message: string }>}
     * @throws {Error} If update fails.
     */
    async updatePassword(accessToken, newPassword) {
        try {
            const userClient = createUserClient(accessToken);
            
            // Update password
            const { data, error } = await userClient.auth.updateUser({
                password: newPassword
            });

            if (error) {
                throw new Error(`Password update failed: ${error.message}`);
            }

            logger.info('Password updated successfully');
            
            return { message: 'Password updated successfully' };

        } catch (error) {
            logger.error('Update password error:', error.message);
            throw error;
        }
    }

    /**
     * Update password after verifying the current password.
     * Enforces password history policy (no recent reuse).
     * @param {string} accessToken User access token.
     * @param {string} currentPassword Current password (verification).
     * @param {string} newPassword New password to set.
     * @returns {Promise<{ message: string, user: { id: string, email: string } }>} Minimal success payload.
     * @throws {Error} If auth, verification, or update fails.
     */
    async updatePasswordWithVerification(accessToken, currentPassword, newPassword) {
        try {
            // First get the current user to verify their identity
            const userClient = createUserClient(accessToken);
            const { data: { user }, error: userError } = await userClient.auth.getUser();

            if (userError) {
                throw new Error(`Authentication failed: ${userError.message}`);
            }

            if (!user || !user.email) {
                throw new Error('User not found');
            }

            // Check if new password was recently used (Issue #133)
            const isPasswordReused = await passwordHistoryService.isPasswordRecentlyUsed(user.id, newPassword);
            if (isPasswordReused) {
                throw new Error('This password was recently used. Please choose a different password.');
            }

            // Verify current password by attempting to sign in
            const { data: signInData, error: signInError } = await supabaseAnonClient.auth.signInWithPassword({
                email: user.email,
                password: currentPassword
            });

            if (signInError) {
                logger.warn('Current password verification failed:', { 
                    userId: user.id, 
                    email: user.email,
                    error: signInError.message 
                });
                throw new Error('Current password is incorrect');
            }

            // Current password verified, now update to new password
            const { data, error } = await userClient.auth.updateUser({
                password: newPassword
            });

            if (error) {
                throw new Error(`Password update failed: ${error.message}`);
            }

            // Password successfully updated - add current password to history
            // Note: We add the OLD password to history, not the new one
            await passwordHistoryService.addToPasswordHistory(user.id, currentPassword);

            logger.info('Password updated successfully with verification:', { 
                userId: user.id, 
                email: user.email 
            });
            
            return { 
                message: 'Password updated successfully',
                user: {
                    id: user.id,
                    email: user.email
                }
            };

        } catch (error) {
            logger.error('Update password with verification error:', error.message);
            throw error;
        }
    }

    /**
     * Verify email confirmation token.
     * @param {string} token Verification token hash.
     * @param {string} type Verification type (e.g., signup, recovery).
     * @param {string} email Email address under verification.
     * @returns {Promise<{ success: boolean, data?: any, error?: string }>}
     */
    async verifyEmail(token, type, email) {
        try {
            // Use Supabase to verify the email token
            const { data, error } = await supabaseAnonClient.auth.verifyOtp({
                token_hash: token,
                type: type,
                email: email
            });

            if (error) {
                logger.error('Email verification failed:', error.message);
                return { success: false, error: error.message };
            }

            logger.info('Email verified successfully:', { email });
            
            return { success: true, data };

        } catch (error) {
            logger.error('Email verification error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Admin: List users with enhanced filtering and search.
     * @param {{ limit?: number, offset?: number, search?: string, plan?: string, active?: boolean, suspended?: boolean, sortBy?: string, sortOrder?: 'asc'|'desc' }} [options]
     * @returns {Promise<{ users: any[], pagination: { total: number, limit: number, offset: number, has_more: boolean } }>}
     */
    async listUsers(options = {}) {
        try {
            const {
                limit = 50,
                offset = 0,
                search = '',
                plan = null,
                active = null,
                suspended = null,
                sortBy = 'created_at',
                sortOrder = 'desc'
            } = options;

            let query = supabaseServiceClient
                .from('users')
                .select(`
                    id, email, name, plan, is_admin, active, suspended, 
                    total_messages_sent, total_tokens_consumed,
                    monthly_messages_sent, monthly_tokens_consumed,
                    last_activity_at, created_at, suspended_reason,
                    suspended_at, suspended_by,
                    organizations!owner_id (id, name, plan_id, monthly_responses_used)
                `);

            // Apply search filter
            if (search && search.trim()) {
                query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
            }

            // Apply plan filter
            if (plan) {
                query = query.eq('plan', plan);
            }

            // Apply active status filter
            if (active !== null) {
                query = query.eq('active', active);
            }

            // Apply suspended status filter
            if (suspended !== null) {
                query = query.eq('suspended', suspended);
            }

            // Apply sorting
            const ascending = sortOrder === 'asc';
            query = query.order(sortBy, { ascending });

            // Apply pagination
            query = query.range(offset, offset + limit - 1);

            const { data: users, error } = await query;

            if (error) {
                throw new Error(`Failed to list users: ${error.message}`);
            }

            // Get total count for pagination
            let countQuery = supabaseServiceClient
                .from('users')
                .select('id', { count: 'exact', head: true });

            // Apply same filters for count
            if (search && search.trim()) {
                countQuery = countQuery.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
            }
            if (plan) {
                countQuery = countQuery.eq('plan', plan);
            }
            if (active !== null) {
                countQuery = countQuery.eq('active', active);
            }
            if (suspended !== null) {
                countQuery = countQuery.eq('suspended', suspended);
            }

            const { count, error: countError } = await countQuery;

            if (countError) {
                logger.warn('Failed to get user count:', countError.message);
            }

            // Add usage alerts for each user
            const usersWithAlerts = await Promise.all(users.map(async user => {
                const planLimits = await this.getPlanLimits(user.plan);
                const alerts = this.checkUsageAlerts(user, planLimits);
                return {
                    ...user,
                    usage_alerts: alerts,
                    is_over_limit: alerts.length > 0
                };
            }));

            return {
                users: usersWithAlerts,
                pagination: {
                    total: count || 0,
                    limit,
                    offset,
                    has_more: (count || 0) > offset + limit
                }
            };

        } catch (error) {
            logger.error('List users error:', error.message);
            throw error;
        }
    }

    /**
     * Admin: Delete user (service client).
     * Removes auth user and best‑effort cleans database user row.
     * @param {string} userId Target user id.
     * @returns {Promise<{ message: string }>}
     */
    async deleteUser(userId) {
        try {
            // Delete from auth (will cascade to related tables via foreign keys)
            const { error: authError } = await supabaseServiceClient.auth.admin.deleteUser(userId);

            if (authError) {
                throw new Error(`Failed to delete user from auth: ${authError.message}`);
            }

            // Delete user record (will trigger cascade delete of organization)
            const { error: dbError } = await supabaseServiceClient
                .from('users')
                .delete()
                .eq('id', userId);

            if (dbError) {
                logger.warn('Failed to delete user record from database:', dbError.message);
            }

            logger.info('User deleted successfully:', { userId });
            
            return { message: 'User deleted successfully' };

        } catch (error) {
            logger.error('Delete user error:', error.message);
            throw error;
        }
    }

    /**
     * Admin: Create user manually (service client).
     * @param {{ email: string, password?: string, name?: string, plan?: string, isAdmin?: boolean }} params
     * @returns {Promise<{ user: any, temporaryPassword: string | null }>}
     */
    async createUserManually({ email, password, name, plan = 'free', isAdmin = false }) {
        try {
            // Generate temporary password if not provided
            const userPassword = password || crypto.randomBytes(16).toString('hex');

            // Create auth user
            const { data: authData, error: authError } = await supabaseServiceClient.auth.admin.createUser({
                email,
                password: userPassword,
                email_confirm: true,
                user_metadata: {
                    name: name || null
                }
            });

            if (authError) {
                throw new Error(`Failed to create auth user: ${authError.message}`);
            }

            // Create user record
            const { data: userData, error: userError } = await supabaseServiceClient
                .from('users')
                .insert({
                    id: authData.user.id,
                    email: authData.user.email,
                    name: name || null,
                    plan,
                    is_admin: isAdmin
                })
                .select()
                .single();

            if (userError) {
                logger.error('Failed to create user record:', userError.message);
                // Cleanup auth user
                await supabaseServiceClient.auth.admin.deleteUser(authData.user.id);
                throw new Error(`Failed to create user profile: ${userError.message}`);
            }

            logger.info('User created manually:', { 
                userId: authData.user.id, 
                email: authData.user.email,
                plan
            });

            return {
                user: userData,
                temporaryPassword: password ? null : userPassword
            };

        } catch (error) {
            logger.error('Create user manually error:', error.message);
            throw error;
        }
    }

    /**
     * Admin: Update user plan (service client).
     * Updates user plan, subscription, organization limits and logs audit trail.
     * Implements rollback mechanism for failed limit application.
     * @param {string} userId Target user id.
     * @param {string} newPlan New plan identifier.
     * @param {string|null} [adminId] Admin performing the change.
     * @returns {Promise<{ message: string, plan: string }>}
     */
    async updateUserPlan(userId, newPlan, adminId = null) {
        let rollbackRequired = false;
        let originalUserData = null;
        let originalSubscriptionData = null;

        try {
            // Validate plan
            const validPlans = ['free', 'starter', 'pro', 'plus', 'custom'];
            if (!validPlans.includes(newPlan)) {
                throw new Error('Invalid plan. Valid plans are: ' + validPlans.join(', '));
            }

            // Get current user data including current plan
            const { data: currentUser, error: getCurrentError } = await supabaseServiceClient
                .from('users')
                .select('id, email, plan, name')
                .eq('id', userId)
                .single();

            if (getCurrentError || !currentUser) {
                throw new Error('User not found');
            }

            const oldPlan = currentUser.plan || 'free';
            originalUserData = { ...currentUser };
            
            // Check if plan is actually changing
            if (oldPlan === newPlan) {
                return {
                    message: 'Plan is already set to ' + newPlan,
                    user: currentUser,
                    newPlan,
                    unchanged: true
                };
            }

            // Get original subscription data for rollback if needed
            const { data: currentSubscription, error: getSubError } = await supabaseServiceClient
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (!getSubError && currentSubscription) {
                originalSubscriptionData = { ...currentSubscription };
            }

            // Validate plan change is allowed (check usage constraints)
            const { getUserUsage } = require('./subscriptionService');
            const currentUsage = await getUserUsage(userId);
            const validation = await isChangeAllowed(oldPlan, newPlan, currentUsage);
            
            if (!validation.allowed) {
                throw new Error(`Plan change not allowed: ${validation.reason}${validation.warnings?.length ? '. Warnings: ' + validation.warnings.join(', ') : ''}`);
            }

            // Get plan duration from plan configuration (Issue #125: configurable duration)
            const { getPlanFeatures, calculatePlanEndDate } = require('./planService');
            const planFeatures = getPlanFeatures(newPlan) || getPlanFeatures('free');
            const planDurationDays = planFeatures?.duration?.days || 30; // Default to 30 if not configured
            const currentPeriodStart = new Date();
            const currentPeriodEnd = calculatePlanEndDate(newPlan, currentPeriodStart);

            // Start transaction-like updates
            const updatePromises = [];

            // 1. Update user plan in users table
            updatePromises.push(
                supabaseServiceClient
                    .from('users')
                    .update({ 
                        plan: newPlan,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userId)
                    .select()
                    .single()
            );

            // 2. Update or create user subscription record
            updatePromises.push(
                supabaseServiceClient
                    .from('user_subscriptions')
                    .upsert({
                        user_id: userId,
                        plan: newPlan,
                        status: 'active',
                        updated_at: new Date().toISOString(),
                        // For admin changes, we don't have Stripe data
                        stripe_customer_id: null,
                        stripe_subscription_id: null,
                        current_period_start: currentPeriodStart.toISOString(),
                        current_period_end: currentPeriodEnd.toISOString()
                    }, { 
                        onConflict: 'user_id',
                        ignoreDuplicates: false 
                    })
                    .select()
            );

            // Execute updates
            const [userResult, subscriptionResult] = await Promise.all(updatePromises);

            if (userResult.error) {
                throw new Error(`Failed to update user plan: ${userResult.error.message}`);
            }

            if (subscriptionResult.error) {
                logger.warn('Failed to update user subscription (proceeding with plan change):', {
                    error: subscriptionResult.error.message,
                    userId,
                    newPlan,
                    warning: 'Subscription table update failed, but user plan was updated successfully'
                });
                
                // Track partial failure in result metadata for admin visibility
                originalUserData.subscriptionUpdateFailed = true;
                originalUserData.subscriptionUpdateError = subscriptionResult.error.message;
            }

            // Mark rollback as required from this point on
            rollbackRequired = true;

            // 3. Apply plan limits immediately (updates organization too)
            // This is the critical point where rollback may be needed
            try {
                await applyPlanLimits(userId, newPlan, 'active');
                logger.info('Plan limits applied successfully:', { userId, newPlan });
            } catch (limitsError) {
                logger.error('Failed to apply plan limits, initiating rollback:', {
                    userId,
                    oldPlan,
                    newPlan,
                    error: limitsError.message
                });

                // Execute rollback
                await this.rollbackPlanChange(userId, originalUserData, originalSubscriptionData);
                
                // Log rollback in audit trail
                await auditService.logPlanChange({
                    userId,
                    fromPlan: newPlan, // Rolling back from new to old
                    toPlan: oldPlan,
                    changeStatus: 'rolled_back',
                    usageSnapshot: {
                        ...currentUsage,
                        timestamp: new Date().toISOString(),
                        change_trigger: 'admin_panel_rollback'
                    },
                    initiatedBy: adminId || 'admin_system',
                    metadata: {
                        admin_initiated: true,
                        rollback_reason: limitsError.message,
                        original_change_attempt: {
                            fromPlan: oldPlan,
                            toPlan: newPlan
                        }
                    }
                });

                // Re-throw with clear rollback message
                throw new Error(`Plan change failed during limits application and was rolled back: ${limitsError.message}`);
            }

            // 4. Log audit trail for admin action (only if everything succeeded)
            await auditService.logPlanChange({
                userId,
                fromPlan: oldPlan,
                toPlan: newPlan,
                changeStatus: 'completed',
                usageSnapshot: {
                    ...currentUsage,
                    timestamp: new Date().toISOString(),
                    change_trigger: 'admin_panel'
                },
                initiatedBy: adminId || 'admin_system',
                metadata: {
                    admin_initiated: true,
                    validation_passed: validation.allowed,
                    validation_warnings: validation.warnings || [],
                    plan_duration_days: planDurationDays
                }
            });

            logger.info('Admin plan change completed:', { 
                userId, 
                oldPlan, 
                newPlan, 
                adminId,
                userEmail: currentUser.email,
                planDurationDays
            });
            
            return {
                message: originalUserData.subscriptionUpdateFailed 
                    ? 'User plan updated with warnings (subscription update failed)' 
                    : 'User plan updated successfully',
                user: userResult.data,
                oldPlan,
                newPlan,
                limitsApplied: true,
                auditLogged: true,
                planDurationDays,
                warnings: originalUserData.subscriptionUpdateFailed ? [{
                    type: 'subscription_update_failed',
                    message: 'Failed to update subscription table',
                    details: originalUserData.subscriptionUpdateError
                }] : []
            };

        } catch (error) {
            logger.error('Update user plan error:', error.message);
            
            // If rollback wasn't already handled and we had made changes, try to rollback
            if (rollbackRequired && !error.message.includes('rolled back')) {
                try {
                    await this.rollbackPlanChange(userId, originalUserData, originalSubscriptionData);
                    logger.info('Emergency rollback completed after unexpected error');
                } catch (rollbackError) {
                    logger.error('Emergency rollback failed:', rollbackError.message);
                    // Continue to throw original error
                }
            }
            
            throw error;
        }
    }

    /**
     * Rollback plan change to restore original state (Issue #125)
     * @private
     */
    async rollbackPlanChange(userId, originalUserData, originalSubscriptionData) {
        try {
            // Rollback user plan
            if (originalUserData) {
                const { error: userRollbackError } = await supabaseServiceClient
                    .from('users')
                    .update({
                        plan: originalUserData.plan,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', userId);

                if (userRollbackError) {
                    logger.error('Failed to rollback user plan:', userRollbackError.message);
                    throw new Error(`User plan rollback failed: ${userRollbackError.message}`);
                }
            }

            // Rollback subscription
            if (originalSubscriptionData) {
                const { error: subRollbackError } = await supabaseServiceClient
                    .from('user_subscriptions')
                    .upsert({
                        ...originalSubscriptionData,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'user_id',
                        ignoreDuplicates: false
                    });

                if (subRollbackError) {
                    logger.warn('Failed to rollback subscription:', subRollbackError.message);
                }
            } else {
                // If no original subscription, remove the newly created one
                const { error: deleteSubError } = await supabaseServiceClient
                    .from('user_subscriptions')
                    .delete()
                    .eq('user_id', userId);

                if (deleteSubError) {
                    logger.warn('Failed to delete subscription during rollback:', deleteSubError.message);
                }
            }

            // Restore original plan limits
            if (originalUserData?.plan) {
                try {
                    await applyPlanLimits(userId, originalUserData.plan, 'active');
                } catch (limitsRollbackError) {
                    logger.error('Failed to restore original plan limits during rollback:', limitsRollbackError.message);
                    // Don't throw here as we want to complete the rollback process
                }
            }

            logger.info('Plan change rollback completed successfully:', {
                userId,
                restoredPlan: originalUserData?.plan
            });

        } catch (error) {
            logger.error('Rollback plan change failed:', error.message);
            throw error;
        }
    }

    /**
     * Admin: Reset user password by sending magic link (service client)
     */
    async adminResetPassword(userId) {
        try {
            // Get user email
            const { data: userData, error: userError } = await supabaseServiceClient
                .from('users')
                .select('email')
                .eq('id', userId)
                .single();

            if (userError || !userData) {
                throw new Error('User not found');
            }

            // Send password reset email using anonymous client
            const { data, error } = await supabaseAnonClient.auth.resetPasswordForEmail(userData.email);

            if (error) {
                throw new Error(`Password reset failed: ${error.message}`);
            }

            logger.info('Admin password reset sent:', { userId, email: userData.email });
            
            return { 
                message: 'Password reset email sent successfully',
                email: userData.email 
            };

        } catch (error) {
            logger.error('Admin reset password error:', error.message);
            throw error;
        }
    }

    /**
     * Admin: Toggle user active status
     */
    async toggleUserActive(userId, adminUserId) {
        try {
            // Get current user status
            const { data: currentUser, error: fetchError } = await supabaseServiceClient
                .from('users')
                .select('active, email')
                .eq('id', userId)
                .single();

            if (fetchError || !currentUser) {
                throw new Error('User not found');
            }

            const newActiveStatus = !currentUser.active;

            // Update user status
            const { data: userData, error: userError } = await supabaseServiceClient
                .from('users')
                .update({ 
                    active: newActiveStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select()
                .single();

            if (userError) {
                throw new Error(`Failed to update user status: ${userError.message}`);
            }

            // Log activity
            await this.logUserActivity(userId, newActiveStatus ? 'account_activated' : 'account_deactivated', {
                performed_by: adminUserId,
                previous_status: currentUser.active
            });

            logger.info('User active status toggled:', { 
                userId, 
                email: currentUser.email,
                newStatus: newActiveStatus,
                adminUserId 
            });
            
            return {
                message: `User account ${newActiveStatus ? 'activated' : 'deactivated'} successfully`,
                user: userData
            };

        } catch (error) {
            logger.error('Toggle user active error:', error.message);
            throw error;
        }
    }

    /**
     * Admin: Suspend user account
     */
    async suspendUser(userId, adminUserId, reason = null) {
        try {
            // Update user suspension status
            const { data: userData, error: userError } = await supabaseServiceClient
                .from('users')
                .update({ 
                    suspended: true,
                    suspended_reason: reason,
                    suspended_at: new Date().toISOString(),
                    suspended_by: adminUserId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select('email')
                .single();

            if (userError) {
                throw new Error(`Failed to suspend user: ${userError.message}`);
            }

            // Log activity
            await this.logUserActivity(userId, 'account_suspended', {
                performed_by: adminUserId,
                reason: reason
            });

            logger.info('User suspended:', { userId, reason, adminUserId });
            
            return {
                message: 'User account suspended successfully',
                reason: reason
            };

        } catch (error) {
            logger.error('Suspend user error:', error.message);
            throw error;
        }
    }

    /**
     * Admin: Unsuspend user account
     */
    async unsuspendUser(userId, adminUserId) {
        try {
            // Update user suspension status
            const { data: userData, error: userError } = await supabaseServiceClient
                .from('users')
                .update({ 
                    suspended: false,
                    suspended_reason: null,
                    suspended_at: null,
                    suspended_by: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select('email')
                .single();

            if (userError) {
                throw new Error(`Failed to unsuspend user: ${userError.message}`);
            }

            // Log activity
            await this.logUserActivity(userId, 'account_reactivated', {
                performed_by: adminUserId
            });

            logger.info('User unsuspended:', { userId, adminUserId });
            
            return {
                message: 'User account reactivated successfully'
            };

        } catch (error) {
            logger.error('Unsuspend user error:', error.message);
            throw error;
        }
    }

    /**
     * Check if user can generate roasts (not suspended)
     */
    async canUserGenerateRoasts(userId) {
        try {
            const { data: user, error } = await supabaseServiceClient
                .from('users')
                .select('active, suspended')
                .eq('id', userId)
                .single();

            if (error) {
                logger.error('Error checking user roast permissions:', error.message);
                return false;
            }

            return user.active && !user.suspended;

        } catch (error) {
            logger.error('Error in canUserGenerateRoasts:', error.message);
            return false;
        }
    }

    /**
     * Admin: Get user statistics
     */
    async getUserStats(userId) {
        try {
            // Get user with basic stats
            const { data: user, error: userError } = await supabaseServiceClient
                .from('users')
                .select(`
                    id, email, name, plan, active, suspended, 
                    total_messages_sent, total_tokens_consumed,
                    monthly_messages_sent, monthly_tokens_consumed,
                    last_activity_at, created_at, suspended_reason,
                    suspended_at, suspended_by
                `)
                .eq('id', userId)
                .single();

            if (userError) {
                throw new Error(`User not found: ${userError.message}`);
            }

            // Get recent activities (last 30 days)
            const { data: activities, error: activitiesError } = await supabaseServiceClient
                .from('user_activities')
                .select('activity_type, platform, tokens_used, created_at, metadata')
                .eq('user_id', userId)
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false })
                .limit(50);

            if (activitiesError) {
                logger.warn('Failed to fetch user activities:', activitiesError.message);
            }

            // Calculate usage patterns
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const monthlyStats = {
                messages_sent: user.monthly_messages_sent || 0,
                tokens_consumed: user.monthly_tokens_consumed || 0,
                activities_count: activities?.length || 0
            };

            // Calculate limits based on plan
            const planLimits = await this.getPlanLimits(user.plan);
            
            // Check for usage alerts
            const alerts = this.checkUsageAlerts(user, planLimits);

            return {
                user: user,
                monthly_stats: monthlyStats,
                recent_activities: activities || [],
                plan_limits: planLimits,
                usage_alerts: alerts,
                is_over_limit: alerts.length > 0
            };

        } catch (error) {
            logger.error('Get user stats error:', error.message);
            throw error;
        }
    }

    /**
     * Log user activity
     */
    async logUserActivity(userId, activityType, metadata = {}) {
        try {
            // Get user's organization
            const { data: user, error: userError } = await supabaseServiceClient
                .from('users')
                .select('id')
                .eq('id', userId)
                .single();

            if (userError) {
                logger.warn('Failed to find user for activity log:', userError.message);
                return;
            }

            // Get user's organization (assuming first one)
            const { data: orgs, error: orgError } = await supabaseServiceClient
                .from('organizations')
                .select('id')
                .eq('owner_id', userId)
                .limit(1);

            const organizationId = orgs?.[0]?.id || null;

            // Insert activity log
            const { error: logError } = await supabaseServiceClient
                .from('user_activities')
                .insert({
                    user_id: userId,
                    organization_id: organizationId,
                    activity_type: activityType,
                    platform: metadata.platform || null,
                    tokens_used: metadata.tokens_used || 0,
                    metadata: metadata
                });

            if (logError) {
                logger.warn('Failed to log user activity:', logError.message);
            }

        } catch (error) {
            logger.warn('Log user activity error:', error.message);
        }
    }

    /**
     * Get plan limits from database
     */
    async getPlanLimits(plan) {
        try {
            // Map old plan names to new plan IDs if needed
            const planMap = {
                'basic': 'free',
                'starter': 'starter',
                'pro': 'pro',
                'creator_plus': 'plus', // Legacy mapping
                'plus': 'plus'
            };
            
            const planId = planMap[plan] || plan || 'free';
            const limits = await planLimitsService.getPlanLimits(planId);
            
            // Map to old format for backward compatibility
            return {
                monthly_messages: limits.monthlyResponsesLimit,
                monthly_tokens: limits.monthlyTokensLimit || limits.monthlyResponsesLimit * 100,
                integrations: limits.integrationsLimit
            };
        } catch (error) {
            logger.error('Failed to get plan limits:', error);
            // Fallback to hardcoded limits
            return this.getFallbackPlanLimits(plan);
        }
    }

    /**
     * Get fallback plan limits (used when database is unavailable)
     * @private
     */
    getFallbackPlanLimits(plan) {
        const limits = {
            free: {
                monthly_messages: 10,
                monthly_tokens: 50000,
                integrations: 2,
                monthly_analysis: 1000
            },
            starter: {
                monthly_messages: 10,
                monthly_tokens: 100000,
                integrations: 2,
                monthly_analysis: 1000
            },
            pro: {
                monthly_messages: 1000,
                monthly_tokens: 500000,
                integrations: 5,
                monthly_analysis: 10000
            },
            plus: {
                monthly_messages: 5000,
                monthly_tokens: 2000000,
                integrations: 10,
                monthly_analysis: 100000
            },
            custom: {
                monthly_messages: -1,
                monthly_tokens: -1,
                integrations: -1,
                monthly_analysis: -1
            }
        };

        return limits[plan] || limits.free;
    }

    /**
     * Sign in with Google OAuth
     */
    async signInWithGoogle() {
        try {
            const { data, error } = await supabaseAnonClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard.html`
                }
            });

            if (error) {
                throw new Error(`Google OAuth failed: ${error.message}`);
            }

            logger.info('Google OAuth initiated successfully');
            
            return { 
                url: data.url,
                message: 'Redirecting to Google authentication...'
            };

        } catch (error) {
            logger.error('Google OAuth error:', error.message);
            throw error;
        }
    }

    /**
     * Handle OAuth callback (for Google and other providers)
     */
    async handleOAuthCallback(accessToken, refreshToken) {
        try {
            // Get user from the session
            const userClient = createUserClient(accessToken);
            const { data: { user }, error: userError } = await userClient.auth.getUser();
            
            if (userError || !user) {
                throw new Error('Failed to get user from OAuth session');
            }

            // Check if user exists in our database
            let { data: profile, error: profileError } = await supabaseServiceClient
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            // If user doesn't exist, create them
            if (profileError && profileError.code === 'PGRST116') {
                const { data: newProfile, error: createError } = await supabaseServiceClient
                    .from('users')
                    .insert({
                        id: user.id,
                        email: user.email,
                        name: user.user_metadata.full_name || user.user_metadata.name,
                        plan: 'basic',
                        is_admin: false,
                        email_confirmed: true // OAuth emails are considered confirmed
                    })
                    .select()
                    .single();

                if (createError) {
                    throw new Error(`Failed to create user profile: ${createError.message}`);
                }

                profile = newProfile;
                logger.info('New user created via OAuth:', { userId: user.id, email: user.email });
            } else if (profileError) {
                throw new Error(`Failed to fetch user profile: ${profileError.message}`);
            }

            logger.info('OAuth login successful:', { userId: user.id, email: user.email });

            return {
                user,
                profile,
                session: {
                    access_token: accessToken,
                    refresh_token: refreshToken
                }
            };

        } catch (error) {
            logger.error('OAuth callback error:', error.message);
            throw error;
        }
    }

    /**
     * Check usage alerts
     */
    checkUsageAlerts(user, planLimits) {
        const alerts = [];

        // Check message limit (80% threshold)
        if (user.monthly_messages_sent > planLimits.monthly_messages * 0.8) {
            alerts.push({
                type: 'warning',
                category: 'messages',
                message: `Usuario ha enviado ${user.monthly_messages_sent} de ${planLimits.monthly_messages} mensajes mensuales (${Math.round(user.monthly_messages_sent / planLimits.monthly_messages * 100)}%)`,
                severity: user.monthly_messages_sent >= planLimits.monthly_messages ? 'high' : 'medium'
            });
        }

        // Check token limit (80% threshold)
        if (user.monthly_tokens_consumed > planLimits.monthly_tokens * 0.8) {
            alerts.push({
                type: 'warning',
                category: 'tokens',
                message: `Usuario ha consumido ${user.monthly_tokens_consumed} de ${planLimits.monthly_tokens} tokens mensuales (${Math.round(user.monthly_tokens_consumed / planLimits.monthly_tokens * 100)}%)`,
                severity: user.monthly_tokens_consumed >= planLimits.monthly_tokens ? 'high' : 'medium'
            });
        }

        // Check if account is suspended
        if (user.suspended) {
            alerts.push({
                type: 'error',
                category: 'account',
                message: 'Cuenta suspendida',
                severity: 'high'
            });
        }

        // Check if account is inactive
        if (!user.active) {
            alerts.push({
                type: 'warning',
                category: 'account',
                message: 'Cuenta desactivada',
                severity: 'medium'
            });
        }

        return alerts;
    }

    /**
     * Change user email with verification
     * @param {string} userId - User ID
     * @param {string} currentEmail - Current email for verification 
     * @param {string} newEmail - New email to change to
     * @param {string} accessToken - User's access token
     */
    async changeEmail({ userId, currentEmail, newEmail, accessToken }) {
        try {
            // Validate input
            if (!userId || !currentEmail || !newEmail || !accessToken) {
                throw new Error('User ID, current email, new email, and access token are required');
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(newEmail)) {
                throw new Error('Invalid new email format');
            }

            // Get current user to verify
            const { data: currentUser, error: userError } = await supabaseServiceClient
                .from('users')
                .select('email, active')
                .eq('id', userId)
                .single();

            if (userError || !currentUser) {
                throw new Error('User not found');
            }

            // Verify current email matches
            if (currentUser.email !== currentEmail) {
                throw new Error('Current email does not match');
            }

            // Check if new email is already in use
            const { data: existingUser, error: checkError } = await supabaseServiceClient
                .from('users')
                .select('id')
                .eq('email', newEmail)
                .single();

            if (existingUser) {
                throw new Error('New email is already in use');
            }

            // Use Supabase auth to update email (this will send confirmation email)
            const userClient = createUserClient(accessToken);
            const { data: authData, error: authError } = await userClient.auth.updateUser({
                email: newEmail
            });

            if (authError) {
                throw new Error(`Failed to initiate email change: ${authError.message}`);
            }

            logger.info('Email change initiated:', { 
                userId, 
                currentEmail, 
                newEmail 
            });

            return {
                message: 'Email change verification sent. Please check your new email to confirm the change.',
                user: authData.user,
                requiresConfirmation: true
            };

        } catch (error) {
            logger.error('Change email error:', error.message);
            throw error;
        }
    }

    /**
     * Confirm email change (called when user clicks confirmation link)
     * @param {string} token - Confirmation token from email
     */
    async confirmEmailChange(token) {
        try {
            if (!token) {
                throw new Error('Confirmation token is required');
            }

            // Supabase handles the token verification automatically
            // We just need to verify the change was successful
            const { data, error } = await supabaseAnonClient.auth.verifyOtp({
                token_hash: token,
                type: 'email_change'
            });

            if (error) {
                throw new Error(`Email change confirmation failed: ${error.message}`);
            }

            if (data.user) {
                // Update our users table with the new email
                const { error: updateError } = await supabaseServiceClient
                    .from('users')
                    .update({ 
                        email: data.user.email,
                        email_updated_at: new Date().toISOString()
                    })
                    .eq('id', data.user.id);

                if (updateError) {
                    logger.error('Failed to update email in users table:', updateError.message);
                }

                logger.info('Email change confirmed successfully:', { 
                    userId: data.user.id, 
                    newEmail: data.user.email 
                });
            }

            return {
                message: 'Email successfully changed',
                user: data.user
            };

        } catch (error) {
            logger.error('Confirm email change error:', error.message);
            throw error;
        }
    }

    /**
     * Export user data (GDPR compliance)
     * @param {string} userId - User ID
     */
    async exportUserData(userId) {
        try {
            if (!userId) {
                throw new Error('User ID is required');
            }

            // Get user profile
            const { data: user, error: userError } = await supabaseServiceClient
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                throw new Error('User not found');
            }

            // Get user organizations
            const { data: organizations, error: orgError } = await supabaseServiceClient
                .from('organizations')
                .select('*')
                .eq('owner_id', userId);

            if (orgError) {
                logger.warn('Failed to fetch user organizations:', orgError.message);
            }

            // Get user activities (last 90 days)
            const { data: activities, error: activitiesError } = await supabaseServiceClient
                .from('user_activities')
                .select('*')
                .eq('user_id', userId)
                .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false })
                .limit(1000);

            if (activitiesError) {
                logger.warn('Failed to fetch user activities:', activitiesError.message);
            }

            // Get integration configs
            const orgIds = organizations?.map(org => org.id) || [];
            let integrations = [];
            
            if (orgIds.length > 0) {
                const { data: integrationsData, error: integrationsError } = await supabaseServiceClient
                    .from('integration_configs')
                    .select('platform, enabled, created_at, updated_at, organization_id')
                    .in('organization_id', orgIds);

                if (integrationsError) {
                    logger.warn('Failed to fetch integrations:', integrationsError.message);
                } else {
                    integrations = integrationsData || [];
                }
            }

            // Prepare export data
            const exportData = {
                export_info: {
                    exported_at: new Date().toISOString(),
                    export_version: '1.0',
                    user_id: userId,
                    note: 'This data export complies with GDPR Article 20 (Right to data portability)'
                },
                profile: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    plan: user.plan,
                    created_at: user.created_at,
                    updated_at: user.updated_at,
                    last_activity_at: user.last_activity_at,
                    email_confirmed: user.email_confirmed,
                    is_admin: user.is_admin,
                    active: user.active
                },
                organizations: (organizations || []).map(org => ({
                    id: org.id,
                    name: org.name,
                    slug: org.slug,
                    plan_id: org.plan_id,
                    created_at: org.created_at,
                    monthly_responses_limit: org.monthly_responses_limit,
                    monthly_responses_used: org.monthly_responses_used,
                    subscription_status: org.subscription_status
                })),
                integrations: integrations.map(integration => ({
                    platform: integration.platform,
                    enabled: integration.enabled,
                    created_at: integration.created_at,
                    updated_at: integration.updated_at
                })),
                activities: (activities || []).map(activity => ({
                    activity_type: activity.activity_type,
                    platform: activity.platform,
                    tokens_used: activity.tokens_used,
                    created_at: activity.created_at
                })),
                usage_statistics: {
                    total_messages_sent: user.total_messages_sent || 0,
                    total_tokens_consumed: user.total_tokens_consumed || 0,
                    monthly_messages_sent: user.monthly_messages_sent || 0,
                    monthly_tokens_consumed: user.monthly_tokens_consumed || 0
                }
            };

            logger.info('User data exported successfully:', { 
                userId, 
                organizations_count: organizations?.length || 0,
                integrations_count: integrations.length,
                activities_count: activities?.length || 0
            });

            return exportData;

        } catch (error) {
            logger.error('Export user data error:', error.message);
            throw error;
        }
    }

    /**
     * Request account deletion with grace period
     * @param {string} userId - User ID
     */
    async requestAccountDeletion(userId) {
        try {
            if (!userId) {
                throw new Error('User ID is required');
            }

            // Check if user exists and isn't already scheduled for deletion
            const { data: user, error: userError } = await supabaseServiceClient
                .from('users')
                .select('email, deletion_scheduled_at, deleted_at')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                throw new Error('User not found');
            }

            if (user.deleted_at) {
                throw new Error('Account is already deleted');
            }

            if (user.deletion_scheduled_at) {
                const scheduledDate = new Date(user.deletion_scheduled_at);
                const daysRemaining = Math.ceil((scheduledDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
                throw new Error(`Account deletion is already scheduled in ${daysRemaining} days. You can cancel it from your settings.`);
            }

            // Set grace period: 30 days from now
            const gracePeriodEnds = new Date();
            gracePeriodEnds.setDate(gracePeriodEnds.getDate() + 30);

            // Update user record with deletion schedule
            const { error: updateError } = await supabaseServiceClient
                .from('users')
                .update({
                    deletion_scheduled_at: gracePeriodEnds.toISOString(),
                    deletion_requested_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) {
                throw new Error(`Failed to schedule account deletion: ${updateError.message}`);
            }

            // Log the deletion request
            await this.logUserActivity(userId, 'account_deletion_requested', {
                grace_period_ends: gracePeriodEnds.toISOString(),
                requested_at: new Date().toISOString()
            });

            logger.info('Account deletion scheduled:', { 
                userId, 
                email: user.email,
                gracePeriodEnds: gracePeriodEnds.toISOString()
            });

            return {
                message: `Eliminación de cuenta programada para ${gracePeriodEnds.toLocaleDateString('es-ES')}. Tienes 30 días para cancelar esta acción.`,
                gracePeriodEnds: gracePeriodEnds.toISOString(),
                canCancel: true
            };

        } catch (error) {
            logger.error('Request account deletion error:', error.message);
            throw error;
        }
    }

    /**
     * Cancel pending account deletion
     * @param {string} userId - User ID
     */
    async cancelAccountDeletion(userId) {
        try {
            if (!userId) {
                throw new Error('User ID is required');
            }

            // Check if user has a pending deletion
            const { data: user, error: userError } = await supabaseServiceClient
                .from('users')
                .select('email, deletion_scheduled_at, deleted_at')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                throw new Error('User not found');
            }

            if (user.deleted_at) {
                throw new Error('Account is already deleted');
            }

            if (!user.deletion_scheduled_at) {
                throw new Error('No pending account deletion found');
            }

            // Check if grace period has expired
            const scheduledDate = new Date(user.deletion_scheduled_at);
            if (Date.now() > scheduledDate.getTime()) {
                throw new Error('Grace period has expired. Account deletion cannot be cancelled.');
            }

            // Cancel the deletion
            const { error: updateError } = await supabaseServiceClient
                .from('users')
                .update({
                    deletion_scheduled_at: null,
                    deletion_requested_at: null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (updateError) {
                throw new Error(`Failed to cancel account deletion: ${updateError.message}`);
            }

            // Log the cancellation
            await this.logUserActivity(userId, 'account_deletion_cancelled', {
                cancelled_at: new Date().toISOString(),
                original_schedule: user.deletion_scheduled_at
            });

            logger.info('Account deletion cancelled:', { 
                userId, 
                email: user.email,
                originalSchedule: user.deletion_scheduled_at
            });

            return {
                message: 'Eliminación de cuenta cancelada exitosamente. Tu cuenta seguirá activa.'
            };

        } catch (error) {
            logger.error('Cancel account deletion error:', error.message);
            throw error;
        }
    }

    /**
     * Execute pending account deletions (called by scheduled job)
     * This should be called periodically (e.g., daily) by a cron job
     */
    async processScheduledDeletions() {
        try {
            const now = new Date().toISOString();
            
            // Find users scheduled for deletion where grace period has expired
            const { data: usersToDelete, error: queryError } = await supabaseServiceClient
                .from('users')
                .select('id, email, deletion_scheduled_at')
                .not('deletion_scheduled_at', 'is', null)
                .is('deleted_at', null)
                .lte('deletion_scheduled_at', now);

            if (queryError) {
                throw new Error(`Failed to query scheduled deletions: ${queryError.message}`);
            }

            if (!usersToDelete || usersToDelete.length === 0) {
                logger.info('No scheduled deletions to process');
                return { processedCount: 0 };
            }

            let processedCount = 0;
            const errors = [];

            for (const user of usersToDelete) {
                try {
                    // Mark as deleted instead of actually deleting (soft delete)
                    const { error: deleteError } = await supabaseServiceClient
                        .from('users')
                        .update({
                            deleted_at: now,
                            email: `deleted_${user.id}@deleted.roastr.ai`, // Anonymize email
                            name: null, // Clear personal data
                            active: false,
                            updated_at: now
                        })
                        .eq('id', user.id);

                    if (deleteError) {
                        throw new Error(`Failed to delete user ${user.id}: ${deleteError.message}`);
                    }

                    // Log the final deletion
                    await this.logUserActivity(user.id, 'account_deleted', {
                        deleted_at: now,
                        original_email: user.email,
                        scheduled_at: user.deletion_scheduled_at
                    });

                    logger.info('User account deleted:', { 
                        userId: user.id,
                        originalEmail: user.email,
                        scheduledAt: user.deletion_scheduled_at
                    });

                    processedCount++;

                } catch (error) {
                    logger.error(`Failed to process deletion for user ${user.id}:`, error.message);
                    errors.push({ userId: user.id, error: error.message });
                }
            }

            logger.info('Scheduled deletions processed:', { 
                total: usersToDelete.length,
                processed: processedCount,
                errors: errors.length
            });

            return { 
                processedCount,
                totalScheduled: usersToDelete.length,
                errors
            };

        } catch (error) {
            logger.error('Process scheduled deletions error:', error.message);
            throw error;
        }
    }
}

module.exports = new AuthService();
