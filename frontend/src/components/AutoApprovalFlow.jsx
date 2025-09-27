/**
 * AutoApprovalFlow Component
 * Issue #405 - Main component for auto-approval flow visualization
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert } from './ui/alert';
import AutoApprovalStatus from './AutoApprovalStatus';
import SecurityValidationIndicator from './SecurityValidationIndicator';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Zap, 
  AlertTriangle,
  MessageSquare,
  Clock
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabaseClient';

const AutoApprovalFlow = ({ comment }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [flowStatus, setFlowStatus] = useState(null);
  const [processedRoast, setProcessedRoast] = useState(null);
  const [stats, setStats] = useState({
    hourlyUsed: 0,
    hourlyLimit: 50,
    dailyUsed: 0,
    dailyLimit: 200
  });

  useEffect(() => {
    loadRateLimitStats();
  }, [user]);

  const loadRateLimitStats = async () => {
    if (!user?.organization_id) return;

    try {
      // In real implementation, would fetch from API
      const mockStats = {
        hourlyUsed: 12,
        hourlyLimit: 50,
        dailyUsed: 45,
        dailyLimit: 200
      };
      setStats(mockStats);
    } catch (error) {
      console.error('Error loading rate limit stats:', error);
    }
  };

  const startAutoApproval = async () => {
    if (!comment || !user) return;

    // Check rate limits
    if (stats.hourlyUsed >= stats.hourlyLimit) {
      toast({
        title: 'Rate Limit Exceeded',
        description: 'You have reached the hourly auto-approval limit. Please wait.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsProcessing(true);
      setFlowStatus('processing_comment');

      // In real implementation, this would call the auto-approval API
      const response = await fetch('/api/comments/' + comment.id + '/auto-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({
          mode: 'auto',
          autoApproval: true
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start auto-approval process');
      }

      const data = await response.json();
      setProcessedRoast(data.roast);

      // Update rate limit stats
      setStats(prev => ({
        ...prev,
        hourlyUsed: prev.hourlyUsed + 1,
        dailyUsed: prev.dailyUsed + 1
      }));

    } catch (error) {
      console.error('Error starting auto-approval:', error);
      toast({
        title: 'Error',
        description: 'Failed to start auto-approval process',
        variant: 'destructive'
      });
      setIsProcessing(false);
      setFlowStatus('failed_publication');
    }
  };

  const pauseFlow = () => {
    setIsPaused(!isPaused);
    // In real implementation, would pause the server-side process
  };

  const retryFlow = () => {
    setFlowStatus(null);
    setProcessedRoast(null);
    startAutoApproval();
  };

  const handleStatusChange = (status, details) => {
    setFlowStatus(status);
    if (status === 'published_successfully') {
      setIsProcessing(false);
      toast({
        title: 'Success!',
        description: 'Roast was automatically approved and published',
        variant: 'success'
      });
    } else if (status.includes('failed')) {
      setIsProcessing(false);
    }
  };

  const canProcess = stats.hourlyUsed < stats.hourlyLimit && stats.dailyUsed < stats.dailyLimit;

  return (
    <div className="space-y-4">
      {/* Rate Limit Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Auto-Approval Flow
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                <Clock className="w-3 h-3 mr-1" />
                {stats.hourlyUsed}/{stats.hourlyLimit} hourly
              </Badge>
              <Badge variant="outline" className="text-xs">
                {stats.dailyUsed}/{stats.dailyLimit} daily
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!canProcess && (
            <Alert variant="warning" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <span className="ml-2">
                Rate limit reached. Auto-approval will resume in the next period.
              </span>
            </Alert>
          )}
          
          {/* Comment Preview */}
          {comment && (
            <div className="p-4 rounded-lg bg-gray-50 mb-4">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-gray-400 mt-1" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">@{comment.author_username}</p>
                  <p className="text-sm text-gray-600 mt-1">{comment.text}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {comment.platform}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      Toxicity: {(comment.toxicity_score * 100).toFixed(0)}%
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {!isProcessing && !flowStatus && (
              <Button 
                onClick={startAutoApproval}
                disabled={!canProcess || !comment}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start Auto-Approval
              </Button>
            )}
            
            {isProcessing && (
              <Button 
                onClick={pauseFlow}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
            )}
            
            {flowStatus && ['failed_security', 'failed_publication'].includes(flowStatus) && (
              <Button 
                onClick={retryFlow}
                variant="outline"
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Display */}
      {(isProcessing || flowStatus) && comment && (
        <AutoApprovalStatus 
          commentId={comment.id}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* Security Validation Details */}
      {flowStatus && ['security_validation', 'auto_approving', 'published_successfully', 'failed_security'].includes(flowStatus) && (
        <SecurityValidationIndicator 
          commentId={comment?.id}
          status={flowStatus}
        />
      )}

      {/* Generated Roast Display */}
      {processedRoast && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Generated Roast</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-green-50 border border-green-200">
              <p className="text-sm text-gray-700">{processedRoast.text}</p>
              {processedRoast.postId && (
                <p className="text-xs text-gray-500 mt-2">
                  Published with ID: {processedRoast.postId}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AutoApprovalFlow;