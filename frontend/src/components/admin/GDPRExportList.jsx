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
  Add as AddIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import JobStatusBadge from './JobStatusBadge';
import ManualExportForm from './ManualExportForm';
import ExportJobDetails from './ExportJobDetails';

/**
 * GDPR Export List component for managing and displaying export jobs
 * Provides filtering, search, pagination, and job management capabilities
 */
const GDPRExportList = () => {
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedExportId, setSelectedExportId] = useState(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [selectedExport, setSelectedExport] = useState(null);
  const [organizations, setOrganizations] = useState([]);

  const exportStatuses = ['pending', 'processing', 'completed', 'failed'];
  const exportTypes = ['weekly', 'manual', 'right_to_be_forgotten'];

  useEffect(() => {
    loadExports();
    loadOrganizations();
  }, [page, rowsPerPage, searchTerm, statusFilter, typeFilter]);

  const loadExports = async () => {
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

      const response = await fetch(`/api/admin/exports?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load exports: ${response.status}`);
      }

      const data = await response.json();
      setExports(data.data || []);
    } catch (err) {
      console.error('Error loading exports:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    try {
      const response = await fetch('/api/admin/organizations', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.data || []);
      }
    } catch (err) {
      console.warn('Could not load organizations:', err);
    }
  };

  const handleCreateExport = async (exportData) => {
    try {
      const response = await fetch('/api/admin/exports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(exportData)
      });

      if (!response.ok) {
        throw new Error(`Failed to create export: ${response.status}`);
      }

      // Refresh the exports list
      loadExports();
    } catch (err) {
      console.error('Error creating export:', err);
      throw err; // Re-throw so the form can handle the error
    }
  };

  const handleDownload = async (exportItem) => {
    if (!exportItem.download_token || exportItem.status !== 'completed') {
      return;
    }

    try {
      const response = await fetch(
        `/api/admin/exports/${exportItem.id}/download/${exportItem.download_token}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
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
      link.download = `gdpr-export-${exportItem.organization_id}-${exportItem.created_at.split('T')[0]}.${exportItem.export_format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError(`Download failed: ${err.message}`);
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

  const getTypeColor = (type) => {
    switch (type) {
      case 'weekly':
        return 'primary';
      case 'manual':
        return 'secondary';
      case 'right_to_be_forgotten':
        return 'warning';
      default:
        return 'default';
    }
  };

  const openActionMenu = (event, exportItem) => {
    setActionMenuAnchor(event.currentTarget);
    setSelectedExport(exportItem);
  };

  const closeActionMenu = () => {
    setActionMenuAnchor(null);
    setSelectedExport(null);
  };

  const openDetailsModal = (exportId) => {
    setSelectedExportId(exportId);
    setShowDetailsModal(true);
    closeActionMenu();
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">GDPR Data Exports</Typography>

        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateForm(true)}
          >
            New Export
          </Button>

          <Tooltip title="Refresh exports list">
            <IconButton onClick={loadExports} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Filters */}
      <Box display="flex" gap={2} mb={3} flexWrap="wrap">
        <TextField
          size="small"
          placeholder="Search exports..."
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
            {exportStatuses.map((status) => (
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
            {exportTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type
                  .split('_')
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')}
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

      {/* Exports Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Export Details</TableCell>
              <TableCell>Organization</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>File Info</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Expires</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {exports.length === 0 && !loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No exports found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              exports.map((exportItem) => (
                <TableRow key={exportItem.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2">
                        {exportItem.id.substring(0, 8)}...
                      </Typography>
                      <Box display="flex" gap={1} mt={0.5}>
                        <Chip
                          label={exportItem.export_type}
                          size="small"
                          color={getTypeColor(exportItem.export_type)}
                        />
                        <Chip
                          label={exportItem.export_format.toUpperCase()}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">{exportItem.organization_id}</Typography>
                    {exportItem.requested_by && (
                      <Typography variant="caption" color="text.secondary">
                        By: {exportItem.requested_by}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <JobStatusBadge status={exportItem.status} />
                    {exportItem.status === 'processing' && exportItem.progress_percentage && (
                      <Box sx={{ mt: 1, minWidth: 80 }}>
                        <LinearProgress
                          variant="determinate"
                          value={exportItem.progress_percentage}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {exportItem.progress_percentage}%
                        </Typography>
                      </Box>
                    )}
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">
                      Size: {formatFileSize(exportItem.file_size)}
                    </Typography>
                    {exportItem.record_count && (
                      <Typography variant="caption" color="text.secondary">
                        {exportItem.record_count.toLocaleString()} records
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2">
                      {new Date(exportItem.created_at).toLocaleString()}
                    </Typography>
                    {exportItem.completed_at && (
                      <Typography variant="caption" color="text.secondary">
                        Completed: {new Date(exportItem.completed_at).toLocaleString()}
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell>
                    {exportItem.expires_at ? (
                      <Typography
                        variant="body2"
                        color={
                          new Date(exportItem.expires_at) < new Date() ? 'error' : 'text.primary'
                        }
                      >
                        {new Date(exportItem.expires_at).toLocaleDateString()}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        N/A
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell align="center">
                    {exportItem.status === 'completed' && exportItem.download_token ? (
                      <Tooltip title="Download export">
                        <IconButton size="small" onClick={() => handleDownload(exportItem)}>
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    ) : null}

                    <Tooltip title="View details">
                      <IconButton size="small" onClick={() => openDetailsModal(exportItem.id)}>
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>

                    <IconButton size="small" onClick={(e) => openActionMenu(e, exportItem)}>
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
        <MenuItem onClick={() => openDetailsModal(selectedExport?.id)}>
          <VisibilityIcon sx={{ mr: 1 }} />
          View Details
        </MenuItem>

        {selectedExport?.status === 'completed' && selectedExport?.download_token && (
          <MenuItem
            onClick={() => {
              handleDownload(selectedExport);
              closeActionMenu();
            }}
          >
            <DownloadIcon sx={{ mr: 1 }} />
            Download
          </MenuItem>
        )}
      </Menu>

      {/* Create Export Modal */}
      <ManualExportForm
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        onSubmit={handleCreateExport}
        organizations={organizations}
      />

      {/* Export Details Modal */}
      <ExportJobDetails
        open={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        exportId={selectedExportId}
        onRefresh={loadExports}
      />
    </Box>
  );
};

export default GDPRExportList;
