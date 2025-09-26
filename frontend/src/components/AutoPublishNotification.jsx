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

    // Custom render function for rich notifications
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
          {event.metadata && (
            <div className="mt-2 space-y-1">
              {event.metadata.roastId && (
                <p className="text-xs text-gray-500">
                  Roast ID: {event.metadata.roastId}
                </p>
              )}
              {event.metadata.postId && (
                <p className="text-xs text-gray-500">
                  Post ID: {event.metadata.postId}
                </p>
              )}
              {event.metadata.platform && (
                <p className="text-xs text-gray-500">
                  Platform: {event.metadata.platform}
                </p>
              )}
            </div>
          )}
          {event.action && (
            <button
              onClick={event.action.onClick}
              className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {event.action.label}
            </button>
          )}
        </div>
      </div>
    );

    toast({
      title: config.title,
      description: event.customMessage || config.description,
      variant: config.variant,
      duration: config.duration,
      content: renderNotification()
    });
  };

  // Return null as this is a notification-only component
  return null;
};

// Hook for easier notification management
export const useAutoPublishNotifications = () => {
  const [events, setEvents] = React.useState([]);

  const notify = (type, customMessage, metadata, action) => {
    const event = {
      id: `event-${Date.now()}-${Math.random()}`,
      type,
      customMessage,
      metadata,
      action,
      timestamp: new Date().toISOString(),
      handled: false
    };
    
    setEvents(prev => [...prev, event]);
  };

  const handleEvent = (eventId) => {
    setEvents(prev => 
      prev.map(event => 
        event.id === eventId ? { ...event, handled: true } : event
      )
    );
  };

  const clearEvents = () => {
    setEvents([]);
  };

  return {
    events,
    notify,
    handleEvent,
    clearEvents
  };
};

export default AutoPublishNotification;