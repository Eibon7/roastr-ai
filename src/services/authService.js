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
     * Admin: List all users (service client)
     */
    async listUsers(limit = 50, offset = 0) {
        try {
            const { data, error } = await supabaseServiceClient
                .from('users')
                .select(`
                    id, email, name, plan, is_admin, created_at,
                    organizations!owner_id (id, name, plan_id, monthly_responses_used)
                `)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                throw new Error(`Failed to list users: ${error.message}`);
            }

            return data;

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
}

module.exports = new AuthService();