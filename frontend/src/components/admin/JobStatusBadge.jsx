import React from 'react';
import { Chip } from '@mui/material';
import {
  Schedule as ScheduleIcon,
  PlayCircle as PlayCircleIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';

/**
 * Job Status Badge component for consistent status display across GDPR components
 * Shows color-coded status with appropriate icons
 */
const JobStatusBadge = ({ status, size = 'small' }) => {
  const getStatusConfig = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return {
          color: 'default',
          icon: <ScheduleIcon sx={{ fontSize: 16 }} />,
          label: 'Pending'
        };
      case 'processing':
      case 'running':
        return {
          color: 'info',
          icon: <PlayCircleIcon sx={{ fontSize: 16 }} />,
          label: 'Processing'
        };
      case 'completed':
      case 'success':
        return {
          color: 'success',
          icon: <CheckCircleIcon sx={{ fontSize: 16 }} />,
          label: 'Completed'
        };
      case 'failed':
      case 'error':
        return {
          color: 'error',
          icon: <ErrorIcon sx={{ fontSize: 16 }} />,
          label: 'Failed'
        };
      case 'cancelled':
      case 'canceled':
        return {
          color: 'warning',
          icon: <CancelIcon sx={{ fontSize: 16 }} />,
          label: 'Cancelled'
        };
      default:
        return {
          color: 'default',
          icon: null,
          label: status || 'Unknown'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Chip
      size={size}
      color={config.color}
      icon={config.icon}
      label={config.label}
      variant="outlined"
    />
  );
};

export default JobStatusBadge;