import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Paper,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Alert,
  LinearProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Schedule as ScheduleIcon,
  Storage as StorageIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import JobStatusBadge from './JobStatusBadge';

/**
 * Modal component for displaying detailed information about GDPR export jobs
 * Provides comprehensive view of export status, metadata, and download capabilities
 */
const ExportJobDetails = ({ open, onClose, exportId, onRefresh }) => {
  const [exportJob, setExportJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  // Load export job details when modal opens
  useEffect(() => {
    if (open && exportId) {
      loadExportDetails();
    }
  }, [open, exportId]);

  const loadExportDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/exports/${exportId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load export details: ${response.status}`);
      }

      const data = await response.json();
      setExportJob(data.data);
    } catch (err) {
      console.error('Error loading export details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!exportJob?.download_token || exportJob.status !== 'completed') {
      return;
    }

    setDownloading(true);
    
    try {
      const response = await fetch(
        `/api/admin/exports/${exportId}/download/${exportJob.download_token}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Download failed: ${response.status}`);
      }

      // Create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gdpr-export-${exportJob.organization_id}-${exportJob.created_at.split('T')[0]}.${exportJob.export_format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError(`Download failed: ${err.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleRefresh = async () => {
    await loadExportDetails();
    if (onRefresh) {
      onRefresh();
    }
  };

  const formatFileSize = (sizeInBytes) => {
    if (!sizeInBytes) return 'N/A';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = sizeInBytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    
    const duration = new Date(endTime) - new Date(startTime);
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '60vh' }
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" component="div">
            Export Job Details
          </Typography>
          <Box>
            <Tooltip title="Refresh details">
              <IconButton onClick={handleRefresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        {exportJob && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            ID: {exportJob.id}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent>
        {loading && <LinearProgress sx={{ mb: 2 }} />}
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {exportJob && (
          <Grid container spacing={3}>
            {/* Status and Basic Info */}
            <Grid item xs={12} md={6}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  <InfoIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Status & Basic Info
                </Typography>
                
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Status" 
                      secondary={<JobStatusBadge status={exportJob.status} />}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText 
                      primary="Export Type" 
                      secondary={
                        <Chip 
                          label={exportJob.export_type} 
                          size="small" 
                          variant="outlined"
                        />
                      }
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText 
                      primary="Format" 
                      secondary={exportJob.export_format.toUpperCase()}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText 
                      primary="Organization" 
                      secondary={exportJob.organization_id}
                    />
                  </ListItem>
                  
                  {exportJob.requested_by && (
                    <ListItem>
                      <ListItemText 
                        primary="Requested By" 
                        secondary={exportJob.requested_by}
                      />
                    </ListItem>
                  )}
                </List>
              </Paper>
            </Grid>

            {/* Timing Information */}
            <Grid item xs={12} md={6}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  <ScheduleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Timing Information
                </Typography>
                
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Created" 
                      secondary={new Date(exportJob.created_at).toLocaleString()}
                    />
                  </ListItem>
                  
                  {exportJob.started_at && (
                    <ListItem>
                      <ListItemText 
                        primary="Started" 
                        secondary={new Date(exportJob.started_at).toLocaleString()}
                      />
                    </ListItem>
                  )}
                  
                  {exportJob.completed_at && (
                    <ListItem>
                      <ListItemText 
                        primary="Completed" 
                        secondary={new Date(exportJob.completed_at).toLocaleString()}
                      />
                    </ListItem>
                  )}
                  
                  <ListItem>
                    <ListItemText 
                      primary="Processing Time" 
                      secondary={formatDuration(exportJob.started_at, exportJob.completed_at)}
                    />
                  </ListItem>
                  
                  {exportJob.expires_at && (
                    <ListItem>
                      <ListItemText 
                        primary="Download Expires" 
                        secondary={new Date(exportJob.expires_at).toLocaleString()}
                      />
                    </ListItem>
                  )}
                </List>
              </Paper>
            </Grid>

            {/* File Information */}
            <Grid item xs={12} md={6}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  File Information
                </Typography>
                
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="File Size" 
                      secondary={formatFileSize(exportJob.file_size)}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText 
                      primary="Record Count" 
                      secondary={exportJob.record_count?.toLocaleString() || 'N/A'}
                    />
                  </ListItem>
                  
                  {exportJob.s3_key && (
                    <ListItem>
                      <ListItemText 
                        primary="S3 Location" 
                        secondary={
                          <Typography variant="body2" sx={{ 
                            fontFamily: 'monospace', 
                            wordBreak: 'break-all' 
                          }}>
                            {exportJob.s3_key}
                          </Typography>
                        }
                      />
                    </ListItem>
                  )}
                </List>
              </Paper>
            </Grid>

            {/* Security & Compliance */}
            <Grid item xs={12} md={6}>
              <Paper elevation={1} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Security & Compliance
                </Typography>
                
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Encryption" 
                      secondary={exportJob.encryption_used ? 'AES-256' : 'None'}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText 
                      primary="Download Available" 
                      secondary={exportJob.download_token ? 'Yes' : 'No'}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText 
                      primary="Access Count" 
                      secondary={exportJob.access_count || 0}
                    />
                  </ListItem>
                  
                  {exportJob.last_accessed_at && (
                    <ListItem>
                      <ListItemText 
                        primary="Last Accessed" 
                        secondary={new Date(exportJob.last_accessed_at).toLocaleString()}
                      />
                    </ListItem>
                  )}
                </List>
              </Paper>
            </Grid>

            {/* Error Information */}
            {exportJob.error_message && (
              <Grid item xs={12}>
                <Alert severity="error">
                  <Typography variant="subtitle2" gutterBottom>
                    Export Failed
                  </Typography>
                  <Typography variant="body2">
                    {exportJob.error_message}
                  </Typography>
                </Alert>
              </Grid>
            )}

            {/* Date Range (for manual exports) */}
            {(exportJob.date_from || exportJob.date_to) && (
              <Grid item xs={12}>
                <Paper elevation={1} sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Export Date Range
                  </Typography>
                  <Typography variant="body2">
                    From: {exportJob.date_from ? new Date(exportJob.date_from).toLocaleDateString() : 'All time'}
                    <br />
                    To: {exportJob.date_to ? new Date(exportJob.date_to).toLocaleDateString() : 'All time'}
                  </Typography>
                </Paper>
              </Grid>
            )}
          </Grid>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
        
        {exportJob?.status === 'completed' && exportJob?.download_token && (
          <Button
            onClick={handleDownload}
            disabled={downloading}
            startIcon={<DownloadIcon />}
            variant="contained"
          >
            {downloading ? 'Downloading...' : 'Download Export'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ExportJobDetails;