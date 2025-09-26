/**
 * AutoApprovalStatus Component
 * Issue #405 - Shows real-time status of auto-approval processes
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2,
  Zap,
  Shield
} from 'lucide-react';

const AutoApprovalStatus = ({ commentId, onStatusChange }) => {
  const [status, setStatus] = useState('idle');
  const [details, setDetails] = useState({
    currentStep: '',
    progress: 0,
    variant: null,
    securityResults: null,
    error: null
  });

  const statusConfig = {
    idle: {
      label: 'Waiting',
      icon: Clock,
      color: 'bg-gray-100 text-gray-700',
      showProgress: false
    },
    processing_comment: {
      label: 'Processing Comment',
      icon: Loader2,
      color: 'bg-blue-100 text-blue-700',
      showProgress: true,
      progress: 10
    },
    generating_variant: {
      label: 'Generating Roast',
      icon: Zap,
      color: 'bg-yellow-100 text-yellow-700',
      showProgress: true,
      progress: 30
    },
    security_validation: {
      label: 'Security Check',
      icon: Shield,
      color: 'bg-purple-100 text-purple-700',
      showProgress: true,
      progress: 60
    },
    auto_approving: {
      label: 'Auto-Approving',
      icon: CheckCircle,
      color: 'bg-green-100 text-green-700',
      showProgress: true,
      progress: 80
    },
    auto_publishing: {
      label: 'Publishing',
      icon: Loader2,
      color: 'bg-blue-100 text-blue-700',
      showProgress: true,
      progress: 90
    },
    published_successfully: {
      label: 'Published',
      icon: CheckCircle,
      color: 'bg-green-100 text-green-700',
      showProgress: false
    },
    failed_security: {
      label: 'Security Failed',
      icon: XCircle,
      color: 'bg-red-100 text-red-700',
      showProgress: false
    },
    failed_publication: {
      label: 'Publication Failed',
      icon: XCircle,
      color: 'bg-red-100 text-red-700',
      showProgress: false
    },
    rate_limited: {
      label: 'Rate Limited',
      icon: AlertCircle,
      color: 'bg-orange-100 text-orange-700',
      showProgress: false
    }
  };

  useEffect(() => {
    if (!commentId) return;

    // Simulate status updates in development
    if (process.env.NODE_ENV === 'development' || process.env.REACT_APP_ENABLE_MOCK_MODE === 'true') {
      simulateAutoApprovalFlow();
    } else {
      // Real implementation would use WebSocket or polling
      pollStatus();
    }
  }, [commentId]);

  const simulateAutoApprovalFlow = () => {
    const steps = [
      { status: 'processing_comment', delay: 1000 },
      { status: 'generating_variant', delay: 3000 },
      { status: 'security_validation', delay: 2000 },
      { status: 'auto_approving', delay: 1000 },
      { status: 'auto_publishing', delay: 2000 },
      { status: 'published_successfully', delay: 0 }
    ];

    let currentIndex = 0;
    
    const runNextStep = () => {
      if (currentIndex >= steps.length) return;
      
      const step = steps[currentIndex];
      setStatus(step.status);
      
      // Update details based on step
      if (step.status === 'generating_variant') {
        setDetails(prev => ({
          ...prev,
          currentStep: 'Generating 1 roast variant with configured tone',
          progress: 30
        }));
      } else if (step.status === 'security_validation') {
        setDetails(prev => ({
          ...prev,
          currentStep: 'Running security validations',
          progress: 60,
          securityResults: {
            contentFilter: true,
            toxicityThreshold: true,
            platformCompliance: true,
            organizationPolicy: true,
            shieldApproval: true
          }
        }));
      } else if (step.status === 'published_successfully') {
        setDetails(prev => ({
          ...prev,
          currentStep: 'Successfully published',
          progress: 100,
          variant: {
            text: 'Generated roast text here...',
            postId: 'pub-123456'
          }
        }));
      }

      currentIndex++;
      if (currentIndex < steps.length) {
        setTimeout(runNextStep, step.delay);
      } else {
        onStatusChange?.('completed', details);
      }
    };

    runNextStep();
  };

  const pollStatus = async () => {
    try {
      const response = await fetch(`/api/roasts/${commentId}/auto-status`);
      const data = await response.json();
      
      setStatus(data.status);
      setDetails(data.details);
      
      // Continue polling if still processing
      if (!['published_successfully', 'failed_security', 'failed_publication', 'rate_limited'].includes(data.status)) {
        setTimeout(pollStatus, 2000);
      } else {
        onStatusChange?.(data.status, data.details);
      }
    } catch (error) {
      console.error('Error polling status:', error);
      setStatus('failed_publication');
      setDetails(prev => ({ ...prev, error: error.message }));
    }
  };

  const currentConfig = statusConfig[status] || statusConfig.idle;
  const Icon = currentConfig.icon;
  const isSpinning = ['processing_comment', 'auto_publishing'].includes(status);

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Auto-Approval Status</CardTitle>
          <Badge className={currentConfig.color}>
            <Icon className={`w-4 h-4 mr-1 ${isSpinning ? 'animate-spin' : ''}`} />
            {currentConfig.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {currentConfig.showProgress && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>{details.currentStep || 'Processing...'}</span>
              <span>{details.progress || currentConfig.progress}%</span>
            </div>
            <Progress value={details.progress || currentConfig.progress} className="h-2" />
          </div>
        )}

        {/* Security Validation Results */}
        {details.securityResults && status !== 'idle' && (
          <div className="p-3 rounded-lg bg-gray-50 space-y-2">
            <p className="text-sm font-medium text-gray-700">Security Validations</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(details.securityResults).map(([key, passed]) => (
                <div key={key} className="flex items-center gap-1">
                  {passed ? (
                    <CheckCircle className="w-3 h-3 text-green-500" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-500" />
                  )}
                  <span className={passed ? 'text-green-700' : 'text-red-700'}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Details */}
        {details.error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{details.error}</p>
          </div>
        )}

        {/* Success Details */}
        {status === 'published_successfully' && details.variant && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm font-medium text-green-700 mb-1">Published Successfully!</p>
            <p className="text-sm text-gray-600">Post ID: {details.variant.postId}</p>
          </div>
        )}

        {/* Rate Limit Warning */}
        {status === 'rate_limited' && (
          <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
            <p className="text-sm text-orange-700">
              Rate limit exceeded. Please wait before processing more comments.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AutoApprovalStatus;