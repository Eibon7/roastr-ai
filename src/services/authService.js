const { supabaseServiceClient, supabaseAnonClient, createUserClient } = require('../config/supabase');
const { logger } = require('../utils/logger');
const crypto = require('crypto');

class AuthService {
    
    /**
     * Sign up a new user with email and password
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
     * Sign up with magic link
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
     * Sign in with email and password
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
     * Sign in with magic link
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
     * Sign out user
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
     * Get current user profile
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
     * Reset password
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
     * Update user profile
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
     * Update password with access token
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
     * Verify email confirmation token
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
     * Admin: List all users with enhanced filtering and search (service client)
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
            const usersWithAlerts = users.map(user => {
                const planLimits = this.getPlanLimits(user.plan);
                const alerts = this.checkUsageAlerts(user, planLimits);
                return {
                    ...user,
                    usage_alerts: alerts,
                    is_over_limit: alerts.length > 0
                };
            });

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
     * Admin: Delete user (service client)
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
     * Admin: Create user manually (service client)
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
     * Admin: Update user plan (service client)
     */
    async updateUserPlan(userId, newPlan) {
        try {
            // Validate plan
            const validPlans = ['free', 'pro', 'creator_plus', 'custom'];
            if (!validPlans.includes(newPlan)) {
                throw new Error('Invalid plan');
            }

            // Update user plan in database
            const { data: userData, error: userError } = await supabaseServiceClient
                .from('users')
                .update({ plan: newPlan })
                .eq('id', userId)
                .select()
                .single();

            if (userError) {
                throw new Error(`Failed to update user plan: ${userError.message}`);
            }

            // Update organization plan if exists
            const { error: orgError } = await supabaseServiceClient
                .from('organizations')
                .update({ plan_id: newPlan })
                .eq('owner_id', userId);

            if (orgError) {
                logger.warn('Failed to update organization plan:', orgError.message);
            }

            logger.info('User plan updated:', { userId, newPlan });
            
            return {
                message: 'User plan updated successfully',
                user: userData,
                newPlan
            };

        } catch (error) {
            logger.error('Update user plan error:', error.message);
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
                    last_activity_at, created_at
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
            const planLimits = this.getPlanLimits(user.plan);
            
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
     * Get plan limits
     */
    getPlanLimits(plan) {
        const limits = {
            basic: {
                monthly_messages: 100,
                monthly_tokens: 10000,
                integrations: 1
            },
            pro: {
                monthly_messages: 1000,
                monthly_tokens: 100000,
                integrations: 5
            },
            creator_plus: {
                monthly_messages: 5000,
                monthly_tokens: 500000,
                integrations: 999
            }
        };

        return limits[plan] || limits.basic;
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
}

module.exports = new AuthService();