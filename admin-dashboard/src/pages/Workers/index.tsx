/**
 * Worker Monitoring Dashboard
 * 
 * Part of Issue #713: Worker Monitoring Dashboard
 * 
 * Provides real-time monitoring of:
 * - Worker status and health
 * - Queue depth and processing
 * - Failed jobs tracking
 * - Performance metrics
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Refresh,
  Timeline as TimelineIcon,
  Storage,
  Speed
} from '@mui/icons-material';
import { useWorkerMetrics, useQueueStatus } from '@hooks/useWorkerMetrics';

/**
 * Format uptime in milliseconds to human-readable string
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format processing time in milliseconds
 */
function formatProcessingTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

/**
 * Get status color
 */
function getStatusColor(status: string): 'success' | 'error' | 'warning' | 'default' {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'operational':
      return 'success';
    case 'unhealthy':
    case 'failed':
    case 'error':
      return 'error';
    case 'warning':
    case 'partial':
      return 'warning';
    default:
      return 'default';
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status: string) {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'operational':
      return <CheckCircle color="success" />;
    case 'unhealthy':
    case 'failed':
    case 'error':
      return <Error color="error" />;
    case 'warning':
    case 'partial':
      return <Warning color="warning" />;
    default:
      return <Warning color="disabled" />;
  }
}

/**
 * Worker Status Card Component
 */
function WorkerStatusCard({ worker }: { worker: any }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" component="div">
            {worker.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Typography>
          {getStatusIcon(worker.status)}
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Processed
            </Typography>
            <Typography variant="h6">
              {worker.processed.toLocaleString()}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Failed
            </Typography>
            <Typography variant="h6" color={worker.failed > 0 ? 'error' : 'text.primary'}>
              {worker.failed.toLocaleString()}
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              Uptime
            </Typography>
            <Typography variant="body2">
              {formatUptime(worker.uptime)}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

/**
 * Queue Status Table Component
 */
function QueueStatusTable({ queues }: { queues: Record<string, any> }) {
  return (
    <Paper>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Queue</TableCell>
            <TableCell align="right">Pending</TableCell>
            <TableCell align="right">Processing</TableCell>
            <TableCell align="right">Completed</TableCell>
            <TableCell align="right">Failed</TableCell>
            <TableCell align="right">DLQ</TableCell>
            <TableCell align="right">Avg Time</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(queues).map(([queueName, queue]) => (
            <TableRow key={queueName}>
              <TableCell component="th" scope="row">
                {queueName.replace(/_/g, ' ')}
              </TableCell>
              <TableCell align="right">{queue.pending || 0}</TableCell>
              <TableCell align="right">{queue.processing || 0}</TableCell>
              <TableCell align="right">{queue.completed || 0}</TableCell>
              <TableCell align="right" sx={{ color: queue.failed > 0 ? 'error.main' : 'inherit' }}>
                {queue.failed || 0}
              </TableCell>
              <TableCell align="right" sx={{ color: queue.dlq > 0 ? 'warning.main' : 'inherit' }}>
                {queue.dlq || 0}
              </TableCell>
              <TableCell align="right">
                {queue.avgProcessingTime > 0 ? formatProcessingTime(queue.avgProcessingTime) : '-'}
              </TableCell>
              <TableCell>
                <Chip
                  label={queue.healthStatus || 'unknown'}
                  color={getStatusColor(queue.healthStatus || 'unknown')}
                  size="small"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

/**
 * Main Workers Dashboard Component
 */
export default function WorkersDashboard() {
  const { data: metrics, isLoading: metricsLoading, error: metricsError } = useWorkerMetrics();
  const { data: queueStatus, isLoading: queueLoading, error: queueError } = useQueueStatus();

  if (metricsLoading || queueLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (metricsError || queueError) {
    return (
      <Box p={3}>
        <Alert severity="error">
          Failed to load worker metrics: {metricsError?.message || queueError?.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#FFF' }}>
      <Box mb={4}>
        <Typography variant="h4" component="h1" gutterBottom>
          Worker Monitoring Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Real-time monitoring of workers, queues, and job processing
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: '#1a1a1a', color: '#FFF' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <CheckCircle color="success" sx={{ mr: 1 }} />
                <Typography variant="h6">Workers</Typography>
              </Box>
              <Typography variant="h4">
                {metrics?.workers.healthy || 0} / {metrics?.workers.total || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Healthy workers
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: '#1a1a1a', color: '#FFF' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Storage color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Queue Depth</Typography>
              </Box>
              <Typography variant="h4">
                {metrics?.queues.totalDepth || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Jobs pending
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: '#1a1a1a', color: '#FFF' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <TimelineIcon color="info" sx={{ mr: 1 }} />
                <Typography variant="h6">Success Rate</Typography>
              </Box>
              <Typography variant="h4">
                {metrics?.jobs.successRate || '0%'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {metrics?.jobs.totalProcessed || 0} processed
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card sx={{ bgcolor: '#1a1a1a', color: '#FFF' }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Speed color="warning" sx={{ mr: 1 }} />
                <Typography variant="h6">Avg Processing</Typography>
              </Box>
              <Typography variant="h4">
                {metrics?.performance.averageProcessingTime > 0
                  ? formatProcessingTime(metrics.performance.averageProcessingTime)
                  : '-'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Per job
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Worker Status Cards */}
      <Box mb={4}>
        <Typography variant="h5" component="h2" gutterBottom mb={2}>
          Worker Status
        </Typography>
        <Grid container spacing={2}>
          {metrics?.workers.details.map((worker) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={worker.type}>
              <WorkerStatusCard worker={worker} />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Queue Status Table */}
      <Box mb={4}>
        <Typography variant="h5" component="h2" gutterBottom mb={2}>
          Queue Status
        </Typography>
        {queueStatus?.queues && (
          <QueueStatusTable queues={queueStatus.queues} />
        )}
      </Box>

      {/* System Info */}
      <Card sx={{ bgcolor: '#1a1a1a', color: '#FFF' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            System Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                System Uptime
              </Typography>
              <Typography variant="body1">
                {metrics?.performance.uptime ? formatUptime(metrics.performance.uptime) : '-'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2" color="text.secondary">
                Last Updated
              </Typography>
              <Typography variant="body1">
                {metrics?.timestamp ? new Date(metrics.timestamp).toLocaleString() : '-'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}


