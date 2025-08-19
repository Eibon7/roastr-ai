const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { supabaseServiceClient } = require('../config/supabase');

const router = express.Router();

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
        const formattedResponses = pendingResponses.map(response => ({
            id: response.id,
            response_text: response.response_text,
            tone: response.tone,
            humor_type: response.humor_type,
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
        }));

        // Get total count for pagination
        let countQuery = supabaseServiceClient
            .from('responses')
            .select('id', { count: 'exact', head: true })
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

        // TODO: Queue the response for actual posting to the platform
        // This would involve adding a job to the job_queue table with type 'post_response'
        const { error: queueError } = await supabaseServiceClient
            .from('job_queue')
            .insert({
                organization_id: orgData.id,
                job_type: 'post_response',
                priority: 3,
                payload: {
                    response_id: id,
                    platform: response.platform,
                    approved_by: user.id,
                    approved_at: new Date().toISOString()
                }
            });

        if (queueError) {
            logger.warn('Failed to queue approved response for posting:', queueError.message);
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

module.exports = router;