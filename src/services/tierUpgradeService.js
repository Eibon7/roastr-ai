/**
 * Tier Upgrade/Downgrade Service - SPEC 10
 * Handles tier changes with immediate upgrades and deferred downgrades
 */

const { supabaseServiceClient } = require('../config/supabase');
const tierValidationService = require('./tierValidationService');
const { logger } = require('../utils/logger');

class TierUpgradeService {
    constructor() {
        // Plan hierarchy for upgrade/downgrade detection
        this.planHierarchy = {
            'free': 0,
            'starter': 1, 
            'pro': 2,
            'plus': 3,
            'custom': 4
        };
    }

    /**
     * Process a tier change request
     * @param {string} userId - User ID
     * @param {string} newTier - New tier to change to
     * @param {Object} options - Change options
     * @returns {Object} Change result
     */
    async processTierChange(userId, newTier, options = {}) {
        try {
            const currentTier = await this.getCurrentTier(userId);
            const changeType = this.determineChangeType(currentTier, newTier);

            logger.info('Processing tier change:', {
                userId,
                currentTier,
                newTier,
                changeType,
                triggeredBy: options.triggeredBy || 'user_action'
            });

            switch (changeType) {
                case 'upgrade':
                    return await this.processUpgrade(userId, newTier, currentTier, options);
                
                case 'downgrade':
                    return await this.processDowngrade(userId, newTier, currentTier, options);
                
                case 'no_change':
                    return {
                        success: true,
                        message: 'Ya tienes este plan activo',
                        currentTier,
                        newTier
                    };
                
                default:
                    throw new Error(`Invalid change type: ${changeType}`);
            }

        } catch (error) {
            logger.error('Error processing tier change:', error);
            throw error;
        }
    }

    /**
     * Process immediate upgrade
     * @private
     */
    async processUpgrade(userId, newTier, currentTier, options) {
        try {
            // Start transaction
            const { data, error } = await supabaseServiceClient.rpc('process_tier_upgrade', {
                p_user_id: userId,
                p_new_tier: newTier,
                p_current_tier: currentTier,
                p_triggered_by: options.triggeredBy || 'user_action',
                p_metadata: JSON.stringify(options.metadata || {})
            });

            if (error) throw error;

            // Reset usage limits immediately for upgrades
            await tierValidationService.handleTierUpgrade(userId, newTier, currentTier);

            // Log the upgrade
            await this.logTierChange(userId, currentTier, newTier, 'upgrade', {
                ...options,
                appliedImmediately: true
            });

            return {
                success: true,
                message: 'Upgrade aplicado inmediatamente. Límites reseteados.',
                previousTier: currentTier,
                newTier: newTier,
                appliedImmediately: true,
                effectiveDate: new Date().toISOString(),
                usageLimitsReset: true
            };

        } catch (error) {
            logger.error('Error processing upgrade:', error);
            throw error;
        }
    }

    /**
     * Process deferred downgrade
     * @private
     */
    async processDowngrade(userId, newTier, currentTier, options) {
        try {
            const nextCycleStart = await this.getNextBillingCycleStart(userId);

            // Schedule downgrade for next billing cycle
            const { data, error } = await supabaseServiceClient
                .from('pending_plan_changes')
                .insert({
                    user_id: userId,
                    current_plan: currentTier,
                    new_plan: newTier,
                    change_type: 'downgrade',
                    effective_date: nextCycleStart,
                    reason: options.reason || 'user_requested',
                    metadata: options.metadata || {},
                    created_by: options.adminUserId || userId
                })
                .select()
                .single();

            if (error) throw error;

            // Handle downgrade logic
            await tierValidationService.handleTierDowngrade(userId, newTier, currentTier);

            // Log the scheduled downgrade
            await this.logTierChange(userId, currentTier, newTier, 'downgrade', {
                ...options,
                scheduledFor: nextCycleStart,
                appliedImmediately: false
            });

            return {
                success: true,
                message: 'Downgrade programado para el siguiente ciclo de facturación',
                previousTier: currentTier,
                newTier: newTier,
                appliedImmediately: false,
                effectiveDate: nextCycleStart,
                scheduledChangeId: data.id,
                usageLimitsReset: false
            };

        } catch (error) {
            logger.error('Error processing downgrade:', error);
            throw error;
        }
    }

    /**
     * Cancel a pending downgrade
     * @param {string} userId - User ID
     * @returns {Object} Cancellation result
     */
    async cancelPendingDowngrade(userId) {
        try {
            const { data: pendingChanges, error } = await supabaseServiceClient
                .from('pending_plan_changes')
                .update({ 
                    processed: true,
                    processed_at: new Date().toISOString(),
                    reason: 'cancelled_by_user'
                })
                .eq('user_id', userId)
                .eq('change_type', 'downgrade')
                .eq('processed', false)
                .select();

            if (error) throw error;

            if (!pendingChanges || pendingChanges.length === 0) {
                return {
                    success: false,
                    message: 'No hay downgrades pendientes para cancelar'
                };
            }

            logger.info('Pending downgrade cancelled:', {
                userId,
                cancelledChanges: pendingChanges.length
            });

            return {
                success: true,
                message: 'Downgrade pendiente cancelado',
                cancelledChanges: pendingChanges.length
            };

        } catch (error) {
            logger.error('Error cancelling pending downgrade:', error);
            throw error;
        }
    }

    /**
     * Get pending plan changes for a user
     * @param {string} userId - User ID
     * @returns {Array} Pending changes
     */
    async getPendingChanges(userId) {
        try {
            const { data, error } = await supabaseServiceClient
                .from('pending_plan_changes')
                .select('*')
                .eq('user_id', userId)
                .eq('processed', false)
                .order('effective_date', { ascending: true });

            if (error) throw error;

            return data || [];

        } catch (error) {
            logger.error('Error fetching pending changes:', error);
            return [];
        }
    }

    /**
     * Process all due plan changes (called by scheduled job)
     * @returns {Object} Processing results
     */
    async processDuePlanChanges() {
        try {
            logger.info('Processing due plan changes...');

            const { data: result, error } = await supabaseServiceClient
                .rpc('process_pending_plan_changes');

            if (error) throw error;

            const processedCount = result || 0;

            logger.info('Plan changes processed:', {
                processedCount,
                timestamp: new Date().toISOString()
            });

            return {
                success: true,
                processedCount,
                message: `Processed ${processedCount} plan changes`
            };

        } catch (error) {
            logger.error('Error processing due plan changes:', error);
            throw error;
        }
    }

    /**
     * Validate tier change eligibility
     * @param {string} userId - User ID
     * @param {string} newTier - Proposed new tier
     * @returns {Object} Validation result
     */
    async validateTierChangeEligibility(userId, newTier) {
        try {
            const currentTier = await this.getCurrentTier(userId);
            const changeType = this.determineChangeType(currentTier, newTier);
            
            // Check for pending changes
            const pendingChanges = await this.getPendingChanges(userId);
            
            if (pendingChanges.length > 0) {
                return {
                    eligible: false,
                    reason: 'pending_changes_exist',
                    message: 'Ya tienes cambios de plan pendientes',
                    pendingChanges
                };
            }

            // Check business rules
            if (changeType === 'downgrade') {
                const canDowngrade = await this.validateDowngradeEligibility(userId, currentTier, newTier);
                if (!canDowngrade.eligible) {
                    return canDowngrade;
                }
            }

            return {
                eligible: true,
                currentTier,
                newTier,
                changeType,
                message: `Cambio de ${currentTier} a ${newTier} es elegible`
            };

        } catch (error) {
            logger.error('Error validating tier change eligibility:', error);
            return {
                eligible: false,
                reason: 'validation_error',
                message: 'Error validating eligibility'
            };
        }
    }

    /**
     * Validate downgrade eligibility
     * @private
     */
    async validateDowngradeEligibility(userId, currentTier, newTier) {
        try {
            // Get current usage
            const usage = await tierValidationService.getCurrentUsage(userId);
            const newTierLimits = await require('./planLimitsService').getPlanLimits(newTier);

            // Check if current usage would exceed new tier limits
            const violations = [];

            if (newTierLimits.monthlyResponsesLimit !== -1 && 
                usage.roastsThisMonth > newTierLimits.monthlyResponsesLimit) {
                violations.push({
                    type: 'roast_usage',
                    current: usage.roastsThisMonth,
                    newLimit: newTierLimits.monthlyResponsesLimit
                });
            }

            if (newTierLimits.monthlyAnalysisLimit !== -1 && 
                usage.analysisThisMonth > newTierLimits.monthlyAnalysisLimit) {
                violations.push({
                    type: 'analysis_usage',
                    current: usage.analysisThisMonth,
                    newLimit: newTierLimits.monthlyAnalysisLimit
                });
            }

            if (violations.length > 0) {
                return {
                    eligible: false,
                    reason: 'usage_exceeds_new_limits',
                    message: 'Tu uso actual excede los límites del nuevo plan',
                    violations,
                    recommendedDate: await this.getNextBillingCycleStart(userId)
                };
            }

            return { eligible: true };

        } catch (error) {
            logger.error('Error validating downgrade eligibility:', error);
            return {
                eligible: true, // Allow on error to avoid blocking
                warning: 'Could not validate usage limits'
            };
        }
    }

    /**
     * Get current tier for user
     * @private
     */
    async getCurrentTier(userId) {
        const { data: subscription, error } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('plan')
            .eq('user_id', userId)
            .single();

        if (error || !subscription) {
            return 'free';
        }

        return subscription.plan;
    }

    /**
     * Determine if change is upgrade, downgrade, or no change
     * @private
     */
    determineChangeType(currentTier, newTier) {
        const currentLevel = this.planHierarchy[currentTier] || 0;
        const newLevel = this.planHierarchy[newTier] || 0;

        if (newLevel > currentLevel) return 'upgrade';
        if (newLevel < currentLevel) return 'downgrade';
        return 'no_change';
    }

    /**
     * Get next billing cycle start date
     * @private
     */
    async getNextBillingCycleStart(userId) {
        const { data: subscription, error } = await supabaseServiceClient
            .from('user_subscriptions')
            .select('current_period_end')
            .eq('user_id', userId)
            .single();

        if (error || !subscription?.current_period_end) {
            // Default to next month if no subscription
            const nextMonth = new Date();
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            nextMonth.setDate(1);
            nextMonth.setHours(0, 0, 0, 0);
            return nextMonth.toISOString();
        }

        return subscription.current_period_end;
    }

    /**
     * Log tier change for audit
     * @private
     */
    async logTierChange(userId, oldTier, newTier, changeType, metadata) {
        try {
            await supabaseServiceClient
                .from('user_activities')
                .insert({
                    user_id: userId,
                    activity_type: 'tier_change',
                    details: {
                        oldTier,
                        newTier,
                        changeType,
                        metadata,
                        timestamp: new Date().toISOString()
                    }
                });
        } catch (error) {
            logger.error('Error logging tier change:', error);
            // Don't throw - logging failure shouldn't break the flow
        }
    }
}

// Export singleton instance
module.exports = new TierUpgradeService();