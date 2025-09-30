/**
 * Security Validation Indicator Component - ROUND 4 Enhancement
 * Shows security validation progress with proper cleanup and error handling
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const SecurityValidationIndicator = ({ 
  validationSteps = [],
  currentStep = 0,
  onValidationComplete,
  onValidationError,
  className = '',
  style = {},
  autoRefresh = false,
  refreshInterval = 5000
}) => {
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState(new Map());
  
  // ROUND 4 FIX: Use refs to track timers for proper cleanup
  const refreshTimerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const validationTimeoutRef = useRef(null);

  // ROUND 4 FIX: Memoized validation progress
  const validationProgress = useMemo(() => {
    if (!Array.isArray(validationSteps) || validationSteps.length === 0) {
      return { completed: 0, total: 0, percentage: 0 };
    }

    const completed = Math.min(currentStep, validationSteps.length);
    const total = validationSteps.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }, [validationSteps, currentStep]);

  // ROUND 4 FIX: Memoized step status
  const stepStatuses = useMemo(() => {
    return validationSteps.map((step, index) => {
      const isCompleted = index < currentStep;
      const isCurrent = index === currentStep;
      const isPending = index > currentStep;
      const hasError = validationResults.has(index) && validationResults.get(index).error;

      return {
        ...step,
        index,
        isCompleted,
        isCurrent,
        isPending,
        hasError,
        result: validationResults.get(index)
      };
    });
  }, [validationSteps, currentStep, validationResults]);

  // ROUND 4 FIX: Auto-refresh with proper cleanup
  useEffect(() => {
    if (autoRefresh && refreshInterval > 0 && isValidating) {
      refreshTimerRef.current = setInterval(() => {
        // Trigger refresh of validation status
        if (onValidationComplete) {
          // In real implementation, this would check validation status
          setProgress(prev => Math.min(prev + 10, 100));
        }
      }, refreshInterval);

      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      };
    }
  }, [autoRefresh, refreshInterval, isValidating, onValidationComplete]);

  // ROUND 4 FIX: Progress animation with cleanup
  useEffect(() => {
    const targetProgress = validationProgress.percentage;
    
    if (targetProgress !== progress) {
      setIsValidating(true);
      
      const animateProgress = () => {
        setProgress(currentProgress => {
          const diff = targetProgress - currentProgress;
          if (Math.abs(diff) < 1) {
            setIsValidating(false);
            return targetProgress;
          }
          
          const step = diff > 0 ? Math.max(1, diff * 0.1) : Math.min(-1, diff * 0.1);
          return currentProgress + step;
        });
      };

      progressTimerRef.current = setInterval(animateProgress, 50);

      return () => {
        if (progressTimerRef.current) {
          clearInterval(progressTimerRef.current);
          progressTimerRef.current = null;
        }
      };
    }
  }, [validationProgress.percentage, progress]);

  // ROUND 4 FIX: Validation timeout with cleanup
  useEffect(() => {
    if (isValidating && validationSteps.length > 0) {
      // Set a timeout for the validation process
      validationTimeoutRef.current = setTimeout(() => {
        setError('Validation timeout - taking longer than expected');
        setIsValidating(false);
        if (onValidationError) {
          onValidationError(new Error('Validation timeout'));
        }
      }, 30000); // 30 second timeout

      return () => {
        if (validationTimeoutRef.current) {
          clearTimeout(validationTimeoutRef.current);
          validationTimeoutRef.current = null;
        }
      };
    }
  }, [isValidating, validationSteps.length, onValidationError]);

  // ROUND 4 FIX: Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, []);

  // ROUND 4 FIX: Handle step completion
  const handleStepComplete = useCallback((stepIndex, result) => {
    setValidationResults(prev => {
      const newResults = new Map(prev);
      newResults.set(stepIndex, result);
      return newResults;
    });

    if (result.error) {
      setError(result.error);
      if (onValidationError) {
        onValidationError(new Error(result.error));
      }
    }
  }, [onValidationError]);

  // ROUND 4 FIX: Handle retry
  const handleRetry = useCallback(() => {
    setError(null);
    setValidationResults(new Map());
    setProgress(0);
    setIsValidating(true);
  }, []);

  // ROUND 4 FIX: Get step icon based on status
  const getStepIcon = useCallback((step) => {
    if (step.hasError) return '❌';
    if (step.isCompleted) return '✅';
    if (step.isCurrent && isValidating) return '⏳';
    if (step.isCurrent) return '🔄';
    return '⭕';
  }, [isValidating]);

  // ROUND 4 FIX: Get step status text
  const getStepStatusText = useCallback((step) => {
    if (step.hasError) return 'Failed';
    if (step.isCompleted) return 'Completed';
    if (step.isCurrent && isValidating) return 'In Progress';
    if (step.isCurrent) return 'Current';
    return 'Pending';
  }, [isValidating]);

  if (!validationSteps || validationSteps.length === 0) {
    return null;
  }

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}
      style={style}
      data-testid="security-validation-indicator"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Security Validation
        </h3>
        <div className="text-sm text-gray-500">
          {validationProgress.completed} of {validationProgress.total} steps
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-700">Overall Progress</span>
          <span className="text-sm font-medium text-gray-900">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ease-out ${
              error ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-red-500 mr-2">⚠️</span>
              <span className="text-sm text-red-700">{error}</span>
            </div>
            <button
              onClick={handleRetry}
              className="text-sm text-red-600 hover:text-red-800 underline"
              data-testid="retry-validation"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Validation Steps */}
      <div className="space-y-3">
        {stepStatuses.map((step) => (
          <div
            key={step.index}
            className={`flex items-center p-3 rounded-lg transition-colors duration-200 ${
              step.isCurrent 
                ? 'bg-blue-50 border border-blue-200' 
                : step.isCompleted 
                ? 'bg-green-50 border border-green-200'
                : step.hasError
                ? 'bg-red-50 border border-red-200'
                : 'bg-gray-50 border border-gray-200'
            }`}
            data-testid={`validation-step-${step.index}`}
          >
            <span className="text-lg mr-3" role="img" aria-label={getStepStatusText(step)}>
              {getStepIcon(step)}
            </span>
            
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                {step.name || `Step ${step.index + 1}`}
              </div>
              {step.description && (
                <div className="text-xs text-gray-600 mt-1">
                  {step.description}
                </div>
              )}
              {step.result && step.result.details && (
                <div className="text-xs text-gray-500 mt-1">
                  {step.result.details}
                </div>
              )}
            </div>
            
            <div className={`text-xs px-2 py-1 rounded-full ${
              step.hasError 
                ? 'bg-red-100 text-red-700'
                : step.isCompleted 
                ? 'bg-green-100 text-green-700'
                : step.isCurrent 
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}>
              {getStepStatusText(step)}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Actions */}
      {validationProgress.completed === validationProgress.total && !error && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <span className="text-green-500 mr-2">✅</span>
            <span className="text-sm text-green-700 font-medium">
              All security validations completed successfully
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecurityValidationIndicator;