const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');

const router = express.Router();

// Error codes for consistent error handling (Issue #419)
const ERROR_CODES = {
  TIMEOUT: 'E_TIMEOUT',
  NETWORK_ERROR: 'E_NETWORK',
  VARIANTS_EXHAUSTED: 'E_VARIANT_LIMIT',
  VALIDATION_ERROR: 'E_VALIDATION',
  SERVER_ERROR: 'E_SERVER'
};

// Configuration constants (Issue #419)
const MAX_VARIANTS_PER_ROAST = 5;

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/approval/pending
 * Get pending roasts awaiting approval
 */
router.get('/pending', async (req, res) => {
    try {
        const { user } = req;
        const { limit = 20, offset = 0, platform } = req.query;

        // Get user's organization
        const { data: orgData } = await supabaseServiceClient
            .from('organizations')
            .select('id')
            .eq('owner_id', user.id)
            .single();

        if (!orgData) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }

        // Build query for pending responses
        let query = supabaseServiceClient
            .from('responses')
            .select(`
                id,
                response_text,
                tone,
                humor_type,
                attempt_number,
                created_at,
                comments!inner (
                    id,
                    platform,
                    platform_comment_id,
                    platform_username,
                    original_text,
                    toxicity_score,
                    severity_level,
                    created_at
                )
            `)
            .eq('organization_id', orgData.id)
            .eq('post_status', 'pending')
            .is('posted_at', null)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        // Filter by platform if specified
        if (platform) {
            query = query.eq('comments.platform', platform);
        }

        const { data: pendingResponses, error } = await query;

        if (error) {
            throw error;
        }

        // Format response data
        const formattedResponses = await Promise.all(pendingResponses.map(async response => {
            // Get attempt count for this specific comment
            const { data: attemptCount } = await supabaseServiceClient
                .rpc('count_roast_attempts', { comment_uuid: response.comments.id });

            return {
                id: response.id,
                response_text: response.response_text,
                tone: response.tone,
                humor_type: response.humor_type,
                attempt_number: response.attempt_number || 1,
                total_attempts: attemptCount || 1,
                created_at: response.created_at,
                comment: {
                    id: response.comments.id,
                    platform: response.comments.platform,
                    platform_comment_id: response.comments.platform_comment_id,
                    platform_username: response.comments.platform_username,
                    original_text: response.comments.original_text,
                    toxicity_score: response.comments.toxicity_score,
                    severity_level: response.comments.severity_level,
                    created_at: response.comments.created_at
                }
            };
        }));

        // Get total count for pagination (must match main query conditions)
        let countQuery = supabaseServiceClient
            .from('responses')
            .select('id, comments!inner(platform)', { count: 'exact', head: true })
            .eq('organization_id', orgData.id)
            .eq('post_status', 'pending')
            .is('posted_at', null);

        if (platform) {
            countQuery = countQuery.eq('comments.platform', platform);
        }

        const { count } = await countQuery;

        res.status(200).json({
            success: true,
            data: {
                pending_responses: formattedResponses,
                pagination: {
                    total: count || 0,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: (parseInt(offset) + formattedResponses.length) < (count || 0)
                }
            }
        });

    } catch (error) {
        logger.error('Get pending approvals error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve pending approvals'
        });
    }
});

/**
 * POST /api/approval/:id/approve
 * Approve a roast for posting
 */
router.post('/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const { user } = req;
        const { edited_text } = req.body; // Optional: allow editing the response

        // Get user's organization
        const { data: orgData } = await supabaseServiceClient
            .from('organizations')
            .select('id')
            .eq('owner_id', user.id)
            .single();

        if (!orgData) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }

        // Get the response and verify ownership (include platform from comment)
        const { data: response, error: getError } = await supabaseServiceClient
            .from('responses')
            .select(`
                *,
                comments(platform)
            `)
            .eq('id', id)
            .eq('organization_id', orgData.id)
            .eq('post_status', 'pending')
            .single();

        if (getError || !response) {
            return res.status(404).json({
                success: false,
                error: 'Response not found or already processed'
            });
        }

        // Prepare update data
        const updateData = {
            post_status: 'approved',
            posted_at: new Date().toISOString()
        };

        // If edited text is provided, update the response text
        if (edited_text && edited_text.trim()) {
            updateData.response_text = edited_text.trim();
        }

        // Update response status to approved
        const { data: updatedResponse, error: updateError } = await supabaseServiceClient
            .from('responses')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            throw updateError;
        }

        // Queue the response for actual posting to the platform
        // Include proper rollback logic for failed job queue inserts
        const { error: queueError } = await supabaseServiceClient
            .from('job_queue')
            .insert({
                organization_id: orgData.id,
                job_type: 'post_response',
                priority: 3,
                payload: {
                    response_id: id,
                    platform: response.comments.platform, // Get platform from joined comment
                    approved_by: user.id,
                    approved_at: new Date().toISOString()
                }
            });

        if (queueError) {
            logger.error('Failed to queue approved response for posting:', queueError.message);
            
            // Rollback the approval - revert the response status to pending
            const { error: rollbackError } = await supabaseServiceClient
                .from('responses')
                .update({
                    post_status: 'pending',
                    posted_at: null
                })
                .eq('id', id);

            if (rollbackError) {
                logger.error('Critical: Failed to rollback response approval after queue error:', rollbackError.message);
            }

            return res.status(500).json({
                success: false,
                error: 'Failed to queue response for posting. Approval has been reverted.'
            });
        }

        // Record attempt history
        const { error: historyError } = await supabaseServiceClient
            .from('roast_attempts')
            .insert({
                organization_id: orgData.id,
                comment_id: response.comment_id,
                response_id: id,
                attempt_number: response.attempt_number || 1,
                status: 'accepted',
                generated_by: response.created_by || null,
                action_taken_by: user.id,
                status_changed_at: new Date().toISOString()
            });

        if (historyError) {
            logger.warn('Failed to record approval history:', historyError.message);
        }

        logger.info(`Response approved: ${id} by user ${user.id}`);

        res.status(200).json({
            success: true,
            message: 'Response approved successfully',
            data: {
                id: updatedResponse.id,
                response_text: updatedResponse.response_text,
                tone: updatedResponse.tone,
                humor_type: updatedResponse.humor_type,
                post_status: updatedResponse.post_status,
                posted_at: updatedResponse.posted_at
            }
        });

    } catch (error) {
        logger.error('Approve response error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to approve response'
        });
    }
});

/**
 * POST /api/approval/:id/reject
 * Reject a roast, preventing it from being posted
 */
router.post('/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { user } = req;
        const { reason } = req.body; // Optional rejection reason

        // Get user's organization
        const { data: orgData } = await supabaseServiceClient
            .from('organizations')
            .select('id')
            .eq('owner_id', user.id)
            .single();

        if (!orgData) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }

        // Get the response and verify ownership
        const { data: response, error: getError } = await supabaseServiceClient
            .from('responses')
            .select('*')
            .eq('id', id)
            .eq('organization_id', orgData.id)
            .eq('post_status', 'pending')
            .single();

        if (getError || !response) {
            return res.status(404).json({
                success: false,
                error: 'Response not found or already processed'
            });
        }

        // Update response status to rejected
        const { data: updatedResponse, error: updateError } = await supabaseServiceClient
            .from('responses')
            .update({
                post_status: 'rejected',
                rejection_reason: reason || null,
                rejected_at: new Date().toISOString(),
                rejected_by: user.id
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            throw updateError;
        }

        // Record attempt history
        const { error: historyError } = await supabaseServiceClient
            .from('roast_attempts')
            .insert({
                organization_id: orgData.id,
                comment_id: response.comment_id,
                response_id: id,
                attempt_number: response.attempt_number || 1,
                status: 'discarded',
                generated_by: response.created_by || null,
                action_taken_by: user.id,
                status_changed_at: new Date().toISOString()
            });

        if (historyError) {
            logger.warn('Failed to record rejection history:', historyError.message);
        }

        logger.info(`Response rejected: ${id} by user ${user.id}${reason ? ` (reason: ${reason})` : ''}`);

        res.status(200).json({
            success: true,
            message: 'Response rejected successfully',
            data: {
                id: updatedResponse.id,
                post_status: updatedResponse.post_status,
                rejection_reason: updatedResponse.rejection_reason,
                rejected_at: updatedResponse.rejected_at
            }
        });

    } catch (error) {
        logger.error('Reject response error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to reject response'
        });
    }
});

/**
 * GET /api/approval/stats
 * Get approval statistics for the organization
 */
router.get('/stats', async (req, res) => {
    try {
        const { user } = req;
        const { days = 30 } = req.query;

        // Get user's organization
        const { data: orgData } = await supabaseServiceClient
            .from('organizations')
            .select('id')
            .eq('owner_id', user.id)
            .single();

        if (!orgData) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }

        const dateThreshold = new Date();
        dateThreshold.setDate(dateThreshold.getDate() - parseInt(days));

        // Get approval stats
        const { data: stats, error } = await supabaseServiceClient
            .from('responses')
            .select('post_status, created_at')
            .eq('organization_id', orgData.id)
            .gte('created_at', dateThreshold.toISOString());

        if (error) {
            throw error;
        }

        // Calculate statistics
        const totalResponses = stats.length;
        const pending = stats.filter(r => r.post_status === 'pending').length;
        const approved = stats.filter(r => r.post_status === 'approved').length;
        const rejected = stats.filter(r => r.post_status === 'rejected').length;
        const posted = stats.filter(r => r.post_status === 'posted').length;

        res.status(200).json({
            success: true,
            data: {
                period_days: parseInt(days),
                total_responses: totalResponses,
                pending_approval: pending,
                approved: approved,
                rejected: rejected,
                posted: posted,
                approval_rate: totalResponses > 0 ? ((approved + posted) / totalResponses * 100).toFixed(1) : 0
            }
        });

    } catch (error) {
        logger.error('Get approval stats error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve approval statistics'
        });
    }
});

/**
 * POST /api/approval/:id/regenerate
 * Regenerate a new roast for the same comment
 */
router.post('/:id/regenerate', async (req, res) => {
    try {
        const { id } = req.params;
        const { user } = req;

        // Get user's organization
        const { data: orgData } = await supabaseServiceClient
            .from('organizations')
            .select('id, plan_id')
            .eq('owner_id', user.id)
            .single();

        if (!orgData) {
            return res.status(404).json({
                success: false,
                error: 'Organization not found'
            });
        }

        // Get the original response and verify ownership
        const { data: originalResponse, error: getError } = await supabaseServiceClient
            .from('responses')
            .select(`
                *,
                comments (
                    id,
                    platform,
                    platform_comment_id,
                    platform_username,
                    original_text,
                    toxicity_score,
                    severity_level
                )
            `)
            .eq('id', id)
            .eq('organization_id', orgData.id)
            .eq('post_status', 'pending')
            .single();

        if (getError || !originalResponse) {
            return res.status(404).json({
                success: false,
                error: 'Response not found or already processed',
                code: ERROR_CODES.VALIDATION_ERROR
            });
        }

        // Check variant limit (Issue #419: Max 5 variants per roast)
        const { data: variantCount, error: countError } = await supabaseServiceClient
            .rpc('count_roast_attempts', { comment_uuid: originalResponse.comment_id });

        if (countError) {
            logger.error('Failed to count variants:', countError.message);
        } else if (variantCount && variantCount >= MAX_VARIANTS_PER_ROAST) {
            logger.warn(`Variant limit reached for comment ${originalResponse.comment_id}: ${variantCount} attempts`);
            return res.status(429).json({
                success: false,
                error: 'VARIANTS_EXHAUSTED',
                message: 'No more variants available for this roast',
                code: ERROR_CODES.VARIANTS_EXHAUSTED,
                current_attempts: variantCount,
                max_attempts: MAX_VARIANTS_PER_ROAST
            });
        }

        // Check usage limits using cost control service
        const CostControlService = require('../services/costControl');
        const costControl = new CostControlService();
        
        const canPerform = await costControl.canPerformOperation(
            orgData.id, 
            'generate_reply', 
            1, 
            originalResponse.comments.platform
        );

        if (!canPerform.allowed) {
            return res.status(429).json({
                success: false,
                error: 'Usage limit reached',
                message: canPerform.message || 'Cannot regenerate roast due to usage limits',
                limits_info: canPerform
            });
        }

        // Get next attempt number
        const { data: nextAttemptNum, error: attemptError } = await supabaseServiceClient
            .rpc('get_next_attempt_number', { comment_uuid: originalResponse.comment_id });

        if (attemptError) {
            logger.error('Failed to get next attempt number:', attemptError.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to calculate attempt number'
            });
        }

        // Generate new roast using the enhanced roast generator
        const RoastGeneratorEnhanced = require('../services/roastGeneratorEnhanced');
        const roastGenerator = new RoastGeneratorEnhanced();

        const userConfig = {
            plan: orgData.plan_id,
            tone: originalResponse.tone || 'sarcastic',
            humor_type: originalResponse.humor_type || 'witty',
            intensity_level: 3 // Default intensity
        };

        const generationResult = await roastGenerator.generateRoast(
            originalResponse.comments.original_text,
            originalResponse.comments.toxicity_score || 0.5,
            originalResponse.tone,
            userConfig
        );

        // Mark original response as discarded
        const { error: discardError } = await supabaseServiceClient
            .from('responses')
            .update({
                post_status: 'discarded'
            })
            .eq('id', id);

        if (discardError) {
            logger.error('Failed to mark original response as discarded:', discardError.message);
        }

        // Create new response record
        const { data: newResponse, error: insertError } = await supabaseServiceClient
            .from('responses')
            .insert({
                organization_id: orgData.id,
                comment_id: originalResponse.comment_id,
                response_text: generationResult.roast,
                tone: originalResponse.tone,
                humor_type: originalResponse.humor_type,
                post_status: 'pending',
                attempt_number: nextAttemptNum,
                parent_response_id: id,
                original_comment_id: originalResponse.comment_id,
                generation_time_ms: generationResult.metadata?.generation_time || null,
                tokens_used: generationResult.metadata?.tokens_used || null,
                cost_cents: generationResult.metadata?.cost_cents || null
            })
            .select()
            .single();

        if (insertError) {
            logger.error('Failed to create new response:', insertError.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to create regenerated response'
            });
        }

        // Record the attempt in roast_attempts table
        const { error: historyError } = await supabaseServiceClient
            .from('roast_attempts')
            .insert([
                // Mark original as regenerated
                {
                    organization_id: orgData.id,
                    comment_id: originalResponse.comment_id,
                    response_id: id,
                    attempt_number: originalResponse.attempt_number || 1,
                    status: 'regenerated',
                    generated_by: user.id,
                    action_taken_by: user.id,
                    status_changed_at: new Date().toISOString()
                },
                // Add new attempt as pending
                {
                    organization_id: orgData.id,
                    comment_id: originalResponse.comment_id,
                    response_id: newResponse.id,
                    attempt_number: nextAttemptNum,
                    status: 'pending',
                    generated_by: user.id,
                    action_taken_by: user.id,
                    status_changed_at: new Date().toISOString()
                }
            ]);

        if (historyError) {
            logger.warn('Failed to record attempt history:', historyError.message);
        }

        // Record usage (consume credits)
        await costControl.recordUsage(
            orgData.id,
            originalResponse.comments.platform,
            'generate_reply',
            { 
                regeneration: true, 
                original_response_id: id,
                tokensUsed: generationResult.metadata?.tokens_used || 0,
                cost_cents: generationResult.metadata?.cost_cents || 5
            },
            user.id,
            1
        );

        logger.info(`Response regenerated: ${id} -> ${newResponse.id} by user ${user.id} (attempt ${nextAttemptNum})`);

        res.status(200).json({
            success: true,
            message: 'Response regenerated successfully',
            data: {
                new_response: {
                    id: newResponse.id,
                    response_text: newResponse.response_text,
                    tone: newResponse.tone,
                    humor_type: newResponse.humor_type,
                    attempt_number: newResponse.attempt_number,
                    created_at: newResponse.created_at
                },
                original_response_id: id,
                attempt_number: nextAttemptNum,
                comment: {
                    id: originalResponse.comments.id,
                    platform: originalResponse.comments.platform,
                    platform_username: originalResponse.comments.platform_username,
                    original_text: originalResponse.comments.original_text,
                    toxicity_score: originalResponse.comments.toxicity_score
                }
            }
        });

    } catch (error) {
        logger.error('Regenerate response error:', error.message);

        // Issue #419: Specific error handling with codes
        if (error.message && error.message.includes('timeout')) {
            return res.status(408).json({
                success: false,
                error: 'TIMEOUT',
                message: 'Variant generation timed out',
                code: ERROR_CODES.TIMEOUT
            });
        }

        if (error.message && error.message.includes('VARIANTS_EXHAUSTED')) {
            return res.status(429).json({
                success: false,
                error: 'VARIANTS_EXHAUSTED',
                message: 'No more variants available for this roast',
                code: ERROR_CODES.VARIANTS_EXHAUSTED
            });
        }

        res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: 'Failed to regenerate response',
            code: ERROR_CODES.SERVER_ERROR
        });
    }
});

module.exports = router;