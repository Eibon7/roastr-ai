import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  IconButton,
  Button,
  Chip,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  LinearProgress,
  Tooltip,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  MoreVert as MoreVertIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import JobStatusBadge from './JobStatusBadge';

/**
 * Data Retention Job List component for managing and monitoring retention jobs
 * Provides filtering, pagination, and job management capabilities
 */
const RetentionJobList = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, job: null, action: null });

  const jobTypes = ['anonymization', 'purge', 'full_cleanup'];
  const jobStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];

  useEffect(() => {
    loadJobs();
  }, [page, rowsPerPage, searchTerm, statusFilter, typeFilter]);

  const loadJobs = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page + 1,
        limit: rowsPerPage,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter && { type: typeFilter })
      });

      const response = await fetch(`/api/admin/retention/jobs?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load retention jobs: ${response.status}`);
      }

      const data = await response.json();
      setJobs(data.data);
    } catch (err) {
      console.error('Error loading retention jobs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJobAction = async (jobId, action) => {
    try {
      const response = await fetch(`/api/admin/retention/jobs/${jobId}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} job: ${response.status}`);
      }

      // Refresh the job list
      loadJobs();

      // Close dialogs
      setActionMenuAnchor(null);
      setConfirmDialog({ open: false, job: null, action: null });
    } catch (err) {
      console.error(`Error ${action} job:`, err);
      setError(`Failed to ${action} job: ${err.message}`);
    }
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime) return 'N/A';

    const end = endTime ? new Date(endTime) : new Date();
    const duration = end - new Date(startTime);
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getJobTypeIcon = (type) => {
    switch (type) {
      case 'anonymization':
        return '🔒';
      case 'purge':
        return '🗑️';
      case 'full_cleanup':
        return '🧹';
      default:
        return '📋';
    }
  };

  const getJobPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  const isJobActionable = (job) => {
    return ['pending', 'processing'].includes(job.status);
  };

  const openActionMenu = (event, job) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedJob(job);
  };

  const closeActionMenu = () => {
    setActionMenuAnchor(null);
    setSelectedJob(null);
  };

  const openConfirmDialog = (job, action) => {
    setConfirmDialog({ open: true, job, action });
    closeActionMenu();
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="between" alignItems="center" mb={3}>
        <Typography variant="h5">Data Retention Jobs</Typography>

        <Box display="flex" gap={2} alignItems="center">
          <Button
            variant="contained"
            startIcon={<ScheduleIcon />}
            onClick={() => {
              // Trigger immediate retention job
              fetch('/api/admin/retention/trigger', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${localStorage.getItem('token')}`
                }
              }).then(() => loadJobs());
            }}
          >
            Run Retention Jobs
          </Button>

          <Tooltip title="Refresh job list">
            <IconButton onClick={loadJobs} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Filters */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search jobs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          sx={{ minWidth: 200 }}
        />

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            label="Status"
          >
            <MenuItem value="">All</MenuItem>
            {jobStatuses.map((status) => (
              <MenuItem key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Type</InputLabel>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} label="Type">
            <MenuItem value="">All</MenuItem>
            {jobTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Jobs Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Job Details</TableCell>
              <TableCell>Organization</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Timing</TableCell>
              <TableCell>Results</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No retention jobs found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => (
                <TableRow key={job.id} hover>
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body2">{getJobTypeIcon(job.job_type)}</Typography>
                      <Box>
                        <Typography variant="subtitle2">
                          {job.job_type.replace('_', ' ').toUpperCase()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {job.id.substring(0, 8)}...
                        </Typography>
                        {job.priority && (
                          <Chip
                            label={job.priority}
                            size="small"
                            color={getJobPriorityColor(job.priority)}
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">{job.organization_id}</Typography>
                    {job.target_date && (
                      <Typography variant="caption" color="text.secondary">
                        Target: {new Date(job.target_date).toLocaleDateString()}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <JobStatusBadge status={job.status} />
                    {job.error_message && (
                      <Tooltip title={job.error_message}>
                        <WarningIcon color="error" sx={{ ml: 1, fontSize: 16 }} />
                      </Tooltip>
                    )}
                  </TableCell>

                  <TableCell>
                    {job.records_processed !== undefined && job.total_records !== undefined ? (
                      <Box>
                        <Typography variant="body2">
                          {job.records_processed.toLocaleString()} /{' '}
                          {job.total_records.toLocaleString()}
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={(job.records_processed / job.total_records) * 100}
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        N/A
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">
                      Created: {new Date(job.created_at).toLocaleDateString()}
                    </Typography>
                    {job.started_at && (
                      <Typography variant="caption" color="text.secondary">
                        Duration: {formatDuration(job.started_at, job.completed_at)}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    {job.status === 'completed' && (
                      <Box>
                        {job.records_anonymized > 0 && (
                          <Typography variant="caption" display="block">
                            🔒 {job.records_anonymized.toLocaleString()} anonymized
                          </Typography>
                        )}
                        {job.records_purged > 0 && (
                          <Typography variant="caption" display="block">
                            🗑️ {job.records_purged.toLocaleString()} purged
                          </Typography>
                        )}
                        {job.storage_freed > 0 && (
                          <Typography variant="caption" display="block" color="success.main">
                            💾 {(job.storage_freed / 1024 / 1024).toFixed(1)} MB freed
                          </Typography>
                        )}
                      </Box>
                    )}
                  </TableCell>

                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={(e) => openActionMenu(e, job)}
                      disabled={!isJobActionable(job) && job.status !== 'completed'}
                    >
                      <MoreVertIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <TablePagination
          component="div"
          count={-1} // Unknown total, use -1 for "more" pagination
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 25, 50]}
        />
      </TableContainer>

      {/* Action Menu */}
      <Menu anchorEl={actionMenuAnchor} open={Boolean(actionMenuAnchor)} onClose={closeActionMenu}>
        {selectedJob?.status === 'pending' && (
          <MenuItem onClick={() => handleJobAction(selectedJob.id, 'start')}>
            <PlayArrowIcon sx={{ mr: 1 }} />
            Start Job
          </MenuItem>
        )}

        {selectedJob?.status === 'processing' && (
          <MenuItem onClick={() => openConfirmDialog(selectedJob, 'pause')}>
            <PauseIcon sx={{ mr: 1 }} />
            Pause Job
          </MenuItem>
        )}

        {['pending', 'processing'].includes(selectedJob?.status) && (
          <MenuItem onClick={() => openConfirmDialog(selectedJob, 'cancel')}>
            <DeleteIcon sx={{ mr: 1 }} />
            Cancel Job
          </MenuItem>
        )}

        <MenuItem
          onClick={() => {
            // View job details
            closeActionMenu();
            console.log('View job details:', selectedJob);
          }}
        >
          <VisibilityIcon sx={{ mr: 1 }} />
          View Details
        </MenuItem>
      </Menu>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, job: null, action: null })}
      >
        <DialogTitle>
          Confirm {confirmDialog.action?.charAt(0).toUpperCase() + confirmDialog.action?.slice(1)}{' '}
          Job
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to {confirmDialog.action} this retention job?
          </Typography>
          {confirmDialog.job && (
            <Box mt={2}>
              <Typography variant="body2" color="text.secondary">
                Job: {confirmDialog.job.job_type} ({confirmDialog.job.id.substring(0, 8)}...)
                <br />
                Organization: {confirmDialog.job.organization_id}
                <br />
                Status: {confirmDialog.job.status}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, job: null, action: null })}>
            Cancel
          </Button>
          <Button
            onClick={() => handleJobAction(confirmDialog.job?.id, confirmDialog.action)}
            color={confirmDialog.action === 'cancel' ? 'error' : 'primary'}
            variant="contained"
          >
            {confirmDialog.action?.charAt(0).toUpperCase() + confirmDialog.action?.slice(1)}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RetentionJobList;
