/**
 * SecurityValidationIndicator Component
 * Issue #405 - Shows detailed security validation results
 * CodeRabbit Round 2 Fix: Enhanced error states and informative indicators
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  Shield, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  FileText,
  Globe,
  Building,
  Zap,
  Clock,
  AlertTriangle,
  Info
} from 'lucide-react';

const SecurityValidationIndicator = ({ commentId, status, metadata }) => {
  const [validations, setValidations] = useState({
    contentFilter: { 
      status: 'pending', 
      message: 'Checking content appropriateness...',
      details: null,
      timestamp: null 
    },
    toxicityThreshold: { 
      status: 'pending', 
      message: 'Analyzing toxicity levels...',
      details: null,
      timestamp: null 
    },
    platformCompliance: { 
      status: 'pending', 
      message: 'Verifying platform rules...',
      details: null,
      timestamp: null 
    },
    organizationPolicy: { 
      status: 'pending', 
      message: 'Checking organization policies...',
      details: null,
      timestamp: null 
    },
    shieldApproval: { 
      status: 'pending', 
      message: 'Running Shield analysis...',
      details: null,
      timestamp: null 
    }
  });

  const [overallStatus, setOverallStatus] = useState('validating');
  const [progress, setProgress] = useState(0);
  const [errorDetails, setErrorDetails] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  const validationIcons = {
    contentFilter: FileText,
    toxicityThreshold: AlertCircle,
    platformCompliance: Globe,
    organizationPolicy: Building,
    shieldApproval: Shield
  };

  const validationLabels = {
    contentFilter: 'Content Filter',
    toxicityThreshold: 'Toxicity Check',
    platformCompliance: 'Platform Rules',
    organizationPolicy: 'Organization Policy',
    shieldApproval: 'Shield Protection'
  };

  useEffect(() => {
    if (status === 'security_validation') {
      runValidations();
    } else if (status === 'failed_security') {
      showFailedValidations();
    } else if (status === 'published_successfully') {
      showPassedValidations();
    }
  }, [status, commentId]);

  const runValidations = async () => {
    const validationSteps = Object.keys(validations);
    let completed = 0;

    for (const step of validationSteps) {
      // Simulate validation delay
      await new Promise(resolve => setTimeout(resolve, 400));
      
      // In development/mock mode, simulate results
      const passed = Math.random() > 0.1; // 90% pass rate
      
      setValidations(prev => ({
        ...prev,
        [step]: {
          status: passed ? 'passed' : 'failed',
          message: passed 
            ? `${validationLabels[step]} passed successfully`
            : `${validationLabels[step]} validation failed`
        }
      }));

      completed++;
      setProgress((completed / validationSteps.length) * 100);
    }

    // Determine overall status
    const allPassed = Object.values(validations).every(v => v.status === 'passed');
    setOverallStatus(allPassed ? 'passed' : 'failed');
  };

  const showFailedValidations = () => {
    setValidations({
      contentFilter: { status: 'passed', message: 'Content filter passed' },
      toxicityThreshold: { status: 'failed', message: 'Toxicity level exceeds threshold' },
      platformCompliance: { status: 'passed', message: 'Platform rules verified' },
      organizationPolicy: { status: 'passed', message: 'Organization policy compliant' },
      shieldApproval: { status: 'failed', message: 'Shield detected potential issues' }
    });
    setOverallStatus('failed');
    setProgress(100);
  };

  const showPassedValidations = () => {
    const allPassed = {};
    Object.keys(validations).forEach(key => {
      allPassed[key] = { 
        status: 'passed', 
        message: `${validationLabels[key]} passed successfully` 
      };
    });
    setValidations(allPassed);
    setOverallStatus('passed');
    setProgress(100);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'error':
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'timeout':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'retrying':
        return <div className="w-5 h-5 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300 animate-spin" />;
    }
  };

  const getOverallStatusConfig = () => {
    switch (overallStatus) {
      case 'passed':
        return {
          color: 'bg-green-100 text-green-700',
          icon: <CheckCircle2 className="w-4 h-4" />,
          text: 'All Validations Passed'
        };
      case 'failed':
        return {
          color: 'bg-red-100 text-red-700',
          icon: <XCircle className="w-4 h-4" />,
          text: 'Validation Failed'
        };
      case 'error':
        return {
          color: 'bg-orange-100 text-orange-700',
          icon: <AlertTriangle className="w-4 h-4" />,
          text: 'Validation Error'
        };
      case 'timeout':
        return {
          color: 'bg-yellow-100 text-yellow-700',
          icon: <Clock className="w-4 h-4" />,
          text: 'Validation Timeout'
        };
      case 'retrying':
        return {
          color: 'bg-blue-100 text-blue-700',
          icon: <div className="w-4 h-4 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />,
          text: `Retrying... (${retryCount}/3)`
        };
      default:
        return {
          color: 'bg-blue-100 text-blue-700',
          icon: <Shield className="w-4 h-4" />,
          text: 'Validating Security'
        };
    }
  };

  const statusConfig = getOverallStatusConfig();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-500" />
            Security Validations
          </CardTitle>
          <Badge className={statusConfig.color}>
            {statusConfig.icon}
            <span className="ml-1">{statusConfig.text}</span>
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {overallStatus === 'validating' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Validating security requirements...</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Individual Validations */}
        <div className="space-y-3">
          {Object.entries(validations).map(([key, validation]) => {
            const Icon = validationIcons[key];
            return (
              <div 
                key={key} 
                className={`p-3 rounded-lg border transition-all ${
                  validation.status === 'passed' 
                    ? 'border-green-200 bg-green-50' 
                    : validation.status === 'failed'
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${
                      validation.status === 'passed' 
                        ? 'text-green-600' 
                        : validation.status === 'failed'
                        ? 'text-red-600'
                        : validation.status === 'error'
                        ? 'text-orange-600'
                        : validation.status === 'timeout'
                        ? 'text-yellow-600'
                        : 'text-gray-400'
                    }`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{validationLabels[key]}</p>
                        {validation.timestamp && (
                          <span className="text-xs text-gray-400">
                            {new Date(validation.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{validation.message}</p>
                      
                      {/* Enhanced details display */}
                      {validation.details && (
                        <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                          {validation.status === 'failed' && (
                            <div className="text-red-600">
                              <strong>Failure Reason:</strong> {validation.details.reason || 'Unknown error'}
                              {validation.details.code && (
                                <span className="ml-2 font-mono">({validation.details.code})</span>
                              )}
                            </div>
                          )}
                          {validation.status === 'error' && (
                            <div className="text-orange-600">
                              <strong>System Error:</strong> {validation.details.error || 'Connection failed'}
                              {validation.details.retryable && (
                                <span className="ml-2 text-blue-600">• Retrying automatically</span>
                              )}
                            </div>
                          )}
                          {validation.status === 'passed' && validation.details && (
                            <div className="text-green-600">
                              {validation.details.score && (
                                <span>Score: {validation.details.score}</span>
                              )}
                              {validation.details.confidence && (
                                <span className="ml-2">Confidence: {validation.details.confidence}%</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {getStatusIcon(validation.status)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Enhanced Summary Messages */}
        {overallStatus === 'failed' && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <div className="flex items-start gap-2">
              <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-red-700 font-medium">
                  Security validation failed
                </p>
                <p className="text-xs text-red-600 mt-1">
                  The roast requires manual review before publication. Review failed validations above for details.
                </p>
                {errorDetails && (
                  <div className="mt-2 p-2 bg-red-100 rounded border border-red-200">
                    <p className="text-xs text-red-700">
                      <strong>System Details:</strong> {errorDetails}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {overallStatus === 'error' && (
          <div className="mt-4 p-3 rounded-lg bg-orange-50 border border-orange-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-orange-700 font-medium">
                  Validation system error
                </p>
                <p className="text-xs text-orange-600 mt-1">
                  Unable to complete security validation due to system issues. Please try again.
                </p>
                <button 
                  className="mt-2 px-3 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs rounded border border-orange-300 transition-colors"
                  onClick={() => {
                    setOverallStatus('validating');
                    setRetryCount(prev => prev + 1);
                    runValidations();
                  }}
                >
                  Retry Validation
                </button>
              </div>
            </div>
          </div>
        )}

        {overallStatus === 'timeout' && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200">
            <div className="flex items-start gap-2">
              <Clock className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-yellow-700 font-medium">
                  Validation timeout
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Security validation is taking longer than expected. This may indicate system load or connectivity issues.
                </p>
                <button 
                  className="mt-2 px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-xs rounded border border-yellow-300 transition-colors"
                  onClick={() => {
                    setOverallStatus('validating');
                    setRetryCount(prev => prev + 1);
                    runValidations();
                  }}
                >
                  Retry Validation
                </button>
              </div>
            </div>
          </div>
        )}

        {overallStatus === 'passed' && (
          <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm text-green-700 font-medium">
                  All security validations passed!
                </p>
                <p className="text-xs text-green-600 mt-0.5">
                  Proceeding with auto-approval. The roast meets all security requirements.
                </p>
              </div>
            </div>
          </div>
        )}

        {overallStatus === 'retrying' && (
          <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-blue-300 border-t-blue-600 animate-spin" />
              <div>
                <p className="text-sm text-blue-700 font-medium">
                  Retrying validation (attempt {retryCount}/3)
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  Re-running security checks after previous attempt failed.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Metadata display for debugging */}
        {metadata && (
          <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-700 font-medium">Validation Details</p>
                <div className="text-xs text-gray-600 mt-1 space-y-1">
                  {metadata.validationId && (
                    <div>ID: <span className="font-mono">{metadata.validationId}</span></div>
                  )}
                  {metadata.duration && (
                    <div>Duration: {metadata.duration}ms</div>
                  )}
                  {metadata.orgId && (
                    <div>Organization: <span className="font-mono">{metadata.orgId}</span></div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SecurityValidationIndicator;