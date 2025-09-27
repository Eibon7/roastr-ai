/**
 * AutoPublishNotification Component
 * Issue #405 - Toast notifications for auto-approval events
 */

import React, { useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Zap,
  Shield,
  Clock
} from 'lucide-react';

const AutoPublishNotification = ({ events, onEventHandled }) => {
  const { toast } = useToast();

  const notificationConfig = {
    roast_auto_generated: {
      title: 'Roast Generated',
      description: 'AI has generated a roast response',
      icon: Zap,
      variant: 'default',
      duration: 3000
    },
    roast_auto_approved: {
      title: 'Auto-Approved',
      description: 'Roast passed all security validations',
      icon: CheckCircle2,
      variant: 'success',
      duration: 4000
    },
    roast_auto_published: {
      title: 'Published Successfully',
      description: 'Your roast has been posted automatically',
      icon: Zap,
      variant: 'success',
      duration: 5000
    },
    auto_approval_failed: {
      title: 'Auto-Approval Failed',
      description: 'Manual review required for this roast',
      icon: AlertCircle,
      variant: 'warning',
      duration: 6000
    },
    security_validation_failed: {
      title: 'Security Check Failed',
      description: 'Content did not pass security validations',
      icon: Shield,
      variant: 'destructive',
      duration: 6000
    },
    rate_limit_exceeded: {
      title: 'Rate Limit Reached',
      description: 'Please wait before processing more comments',
      icon: Clock,
      variant: 'warning',
      duration: 5000
    }
  };

  useEffect(() => {
    if (!events || events.length === 0) return;

    // Process the latest event
    const latestEvent = events[events.length - 1];
    if (latestEvent && !latestEvent.handled) {
      showNotification(latestEvent);
      onEventHandled?.(latestEvent.id);
    }
  }, [events]);

  const showNotification = (event) => {
    const config = notificationConfig[event.type];
    if (!config) return;

    const Icon = config.icon;

    // SECURITY FIX Round 2: Enhanced Toast API with rich content support
    // Addresses CodeRabbit feedback on custom content support
    const renderNotification = () => (
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${
          config.variant === 'success' ? 'text-green-500' :
          config.variant === 'warning' ? 'text-yellow-500' :
          config.variant === 'destructive' ? 'text-red-500' :
          'text-blue-500'
        }`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">{config.title}</p>
          <p className="text-sm text-gray-600 mt-0.5">
            {event.customMessage || config.description}
          </p>
          
          {/* Enhanced metadata display with rich content support */}
          {event.metadata && (
            <div className="mt-2 space-y-1">
              {/* Security validation details */}
              {event.metadata.securityValidations && (
                <div className="bg-gray-50 rounded-md p-2 text-xs">
                  <p className="font-medium text-gray-700 mb-1">Security Checks:</p>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(event.metadata.securityValidations).map(([check, passed]) => (
                      <div key={check} className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${passed ? 'bg-green-400' : 'bg-red-400'}`} />
                        <span className="capitalize text-gray-600">{check.replace('_', ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Rate limit information */}
              {event.metadata.rateLimits && (
                <div className="bg-yellow-50 rounded-md p-2 text-xs">
                  <p className="font-medium text-yellow-700 mb-1">Rate Limits:</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Hourly:</span>
                      <span>{event.metadata.rateLimits.hourly?.count || 0}/{event.metadata.rateLimits.hourly?.limit || 50}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Daily:</span>
                      <span>{event.metadata.rateLimits.daily?.count || 0}/{event.metadata.rateLimits.daily?.limit || 200}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Content validation details */}
              {event.metadata.contentValidation && (
                <div className="bg-blue-50 rounded-md p-2 text-xs">
                  <p className="font-medium text-blue-700 mb-1">Content Validation:</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Layers Validated:</span>
                      <span>{event.metadata.contentValidation.layersValidated || 0}/4</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Checksum:</span>
                      <span className="font-mono text-xs">
                        {event.metadata.contentValidation.checksum?.substring(0, 8) || 'N/A'}...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Error details for failed operations */}
              {event.metadata.error && (
                <div className="bg-red-50 rounded-md p-2 text-xs">
                  <p className="font-medium text-red-700 mb-1">Error Details:</p>
                  <p className="text-red-600">{event.metadata.error}</p>
                  {event.metadata.validationId && (
                    <p className="mt-1 text-red-500 font-mono text-xs">
                      ID: {event.metadata.validationId}
                    </p>
                  )}
                </div>
              )}
              
              {/* Performance metrics */}
              {event.metadata.performance && (
                <div className="bg-green-50 rounded-md p-2 text-xs">
                  <p className="font-medium text-green-700 mb-1">Performance:</p>
                  <div className="grid grid-cols-2 gap-1 text-green-600">
                    {event.metadata.performance.generationTime && (
                      <div>Generation: {event.metadata.performance.generationTime}ms</div>
                    )}
                    {event.metadata.performance.validationTime && (
                      <div>Validation: {event.metadata.performance.validationTime}ms</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Action buttons for interactive notifications */}
          {event.actions && event.actions.length > 0 && (
            <div className="mt-3 flex gap-2">
              {event.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={`text-xs px-2 py-1 rounded font-medium ${
                    action.variant === 'primary' 
                      ? 'bg-blue-500 text-white hover:bg-blue-600' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );

    // Enhanced toast API call with rich content support
    toast({
      duration: config.duration,
      variant: config.variant,
      content: renderNotification(), // Custom content support
      className: "max-w-md"
    });
  };

  return null; // This component doesn't render anything directly
};

// Enhanced hook for programmatic toast usage
export const useAutoPublishNotifications = () => {
  const { toast } = useToast();

  const showRichNotification = (eventType, metadata = {}, customMessage = null, actions = []) => {
    const component = (
      <AutoPublishNotification 
        events={[{
          id: Date.now(),
          type: eventType,
          metadata,
          customMessage,
          actions,
          handled: false
        }]}
        onEventHandled={() => {}}
      />
    );
    
    return component;
  };

  return { showRichNotification };
};

export default AutoPublishNotification;