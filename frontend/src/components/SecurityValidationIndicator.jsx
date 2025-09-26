/**
 * SecurityValidationIndicator Component
 * Issue #405 - Shows detailed security validation results
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
  Zap
} from 'lucide-react';

const SecurityValidationIndicator = ({ commentId, status }) => {
  const [validations, setValidations] = useState({
    contentFilter: { status: 'pending', message: 'Checking content appropriateness...' },
    toxicityThreshold: { status: 'pending', message: 'Analyzing toxicity levels...' },
    platformCompliance: { status: 'pending', message: 'Verifying platform rules...' },
    organizationPolicy: { status: 'pending', message: 'Checking organization policies...' },
    shieldApproval: { status: 'pending', message: 'Running Shield analysis...' }
  });

  const [overallStatus, setOverallStatus] = useState('validating');
  const [progress, setProgress] = useState(0);

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
                        : 'text-gray-400'
                    }`} />
                    <div>
                      <p className="font-medium text-sm">{validationLabels[key]}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{validation.message}</p>
                    </div>
                  </div>
                  {getStatusIcon(validation.status)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Message */}
        {overallStatus === 'failed' && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">
              <strong>Security validation failed.</strong> The roast requires manual review before publication.
            </p>
          </div>
        )}

        {overallStatus === 'passed' && (
          <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-700">
                <strong>All security validations passed!</strong> Proceeding with auto-approval.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SecurityValidationIndicator;