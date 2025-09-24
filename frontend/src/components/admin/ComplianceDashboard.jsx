import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  LinearProgress,
  Chip,
  Button,
  Tooltip,
  IconButton,
  Divider
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Security as SecurityIcon,
  Storage as StorageIcon,
  Assessment as AssessmentIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon
} from '@mui/icons-material';

/**
 * Compliance Dashboard component for monitoring GDPR compliance status
 * Shows retention schedules, compliance violations, and system health
 */
const ComplianceDashboard = () => {
  const [complianceData, setComplianceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    loadComplianceData();
  }, []);

  const loadComplianceData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [retentionResponse, complianceResponse] = await Promise.all([
        fetch('/api/admin/retention/status', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }),
        fetch('/api/admin/retention/compliance', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
      ]);

      if (!retentionResponse.ok || !complianceResponse.ok) {
        throw new Error('Failed to load compliance data');
      }

      const retentionData = await retentionResponse.json();
      const complianceInfo = await complianceResponse.json();

      setComplianceData({
        retention: retentionData.data,
        compliance: complianceInfo.data
      });
      
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading compliance data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getComplianceScoreColor = (score) => {
    if (score >= 95) return 'success';
    if (score >= 85) return 'warning';
    return 'error';
  };

  const getViolationSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const formatDaysOverdue = (daysOverdue) => {
    if (daysOverdue <= 0) return 'On time';
    if (daysOverdue === 1) return '1 day overdue';
    return `${daysOverdue} days overdue`;
  };

  if (loading && !complianceData) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Compliance Dashboard
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Compliance Dashboard
        </Typography>
        <Alert severity="error">
          {error}
        </Alert>
      </Box>
    );
  }

  const { retention, compliance } = complianceData || {};

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Compliance Dashboard
        </Typography>
        <Box display="flex" alignItems="center" gap={2}>
          {lastRefresh && (
            <Typography variant="body2" color="text.secondary">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </Typography>
          )}
          <Tooltip title="Refresh compliance data">
            <IconButton onClick={loadComplianceData} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Grid container spacing={3}>
        {/* Overall Compliance Score */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AssessmentIcon sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Overall Compliance Score
                </Typography>
              </Box>
              
              {compliance?.overall_score !== undefined && (
                <>
                  <Typography variant="h3" color={getComplianceScoreColor(compliance.overall_score)}>
                    {compliance.overall_score}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={compliance.overall_score}
                    color={getComplianceScoreColor(compliance.overall_score)}
                    sx={{ mt: 1, mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Based on retention policies and violation count
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Retention Overview */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ScheduleIcon sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Data Retention Status
                </Typography>
              </Box>
              
              {retention && (
                <>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Pending Jobs
                      </Typography>
                      <Typography variant="h4">
                        {retention.pending_jobs || 0}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Overdue Jobs
                      </Typography>
                      <Typography variant="h4" color={retention.overdue_jobs > 0 ? 'error' : 'success'}>
                        {retention.overdue_jobs || 0}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  <Box mt={2}>
                    <Typography variant="body2" color="text.secondary">
                      Last Successful Run: {retention.last_successful_run ? 
                        new Date(retention.last_successful_run).toLocaleString() : 
                        'Never'
                      }
                    </Typography>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Security Status */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <SecurityIcon sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Security Status
                </Typography>
              </Box>
              
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="S3 Encryption" 
                    secondary="AES-256 active"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <CheckCircleIcon color="success" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Access Logging" 
                    secondary="All downloads tracked"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    {retention?.audit_logs_enabled ? 
                      <CheckCircleIcon color="success" /> : 
                      <ErrorIcon color="error" />
                    }
                  </ListItemIcon>
                  <ListItemText 
                    primary="Audit Logging" 
                    secondary={retention?.audit_logs_enabled ? 'Active' : 'Disabled'}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Compliance Violations */}
        <Grid item xs={12} md={8}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Compliance Violations
            </Typography>
            
            {compliance?.violations && compliance.violations.length > 0 ? (
              <List>
                {compliance.violations.map((violation, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemIcon>
                        {getViolationSeverityIcon(violation.severity)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle1">
                              {violation.type}
                            </Typography>
                            <Chip 
                              label={violation.severity} 
                              size="small" 
                              color={violation.severity === 'critical' ? 'error' : 'warning'}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2">
                              {violation.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Organization: {violation.organization_id} | 
                              {violation.days_overdue > 0 ? 
                                ` ${formatDaysOverdue(violation.days_overdue)}` : 
                                ' On schedule'
                              }
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < compliance.violations.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box textAlign="center" py={3}>
                <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
                <Typography variant="h6" color="success.main">
                  No Compliance Violations
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  All data retention policies are being followed correctly
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Paper elevation={1} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            
            <Box display="flex" flexDirection="column" gap={1}>
              <Button
                variant="outlined"
                startIcon={<ScheduleIcon />}
                onClick={() => {
                  // Trigger manual retention job
                  fetch('/api/admin/retention/trigger', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                  }).then(() => loadComplianceData());
                }}
                disabled={loading}
              >
                Run Retention Jobs
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<StorageIcon />}
                onClick={() => {
                  // Generate compliance report
                  window.open('/api/admin/retention/compliance-report', '_blank');
                }}
              >
                Download Compliance Report
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<AssessmentIcon />}
                onClick={() => {
                  // View detailed audit logs
                  window.open('/api/admin/retention/audit-logs', '_blank');
                }}
              >
                View Audit Logs
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Data Retention Summary */}
        {retention?.summary && (
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Data Retention Summary (Last 30 Days)
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="primary">
                      {retention.summary.anonymized_records || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Records Anonymized
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="error">
                      {retention.summary.purged_records || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Records Purged
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="success.main">
                      {retention.summary.successful_jobs || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Successful Jobs
                    </Typography>
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <Box textAlign="center">
                    <Typography variant="h4" color="warning.main">
                      {retention.summary.failed_jobs || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Failed Jobs
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default ComplianceDashboard;