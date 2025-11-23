import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Alert,
  Box,
  FormHelperText,
  Autocomplete
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

/**
 * Manual Export Form component for triggering GDPR data exports
 * Provides form interface for creating manual export jobs with date ranges and filters
 */
const ManualExportForm = ({ open, onClose, onSubmit, organizations = [] }) => {
  const [formData, setFormData] = useState({
    organizationId: '',
    exportType: 'full',
    exportFormat: 'json',
    dateFrom: null,
    dateTo: null,
    includePersonalData: true,
    includeAnalytics: true,
    includeComments: true,
    includeResponses: true
  });

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const exportTypes = [
    { value: 'full', label: 'Full Export', description: 'All user data and analytics' },
    {
      value: 'personal_data',
      label: 'Personal Data Only',
      description: 'User profile and settings'
    },
    { value: 'analytics', label: 'Analytics Data', description: 'Usage metrics and statistics' },
    {
      value: 'comments',
      label: 'Comments & Interactions',
      description: 'User comments and engagement'
    },
    { value: 'custom', label: 'Custom Selection', description: 'Choose specific data types' }
  ];

  const exportFormats = [
    { value: 'json', label: 'JSON', description: 'Machine-readable JSON format' },
    { value: 'csv', label: 'CSV', description: 'Spreadsheet-compatible format' }
  ];

  const validateForm = () => {
    const newErrors = {};

    if (!formData.organizationId) {
      newErrors.organizationId = 'Organization is required';
    }

    if (!formData.exportType) {
      newErrors.exportType = 'Export type is required';
    }

    if (!formData.exportFormat) {
      newErrors.exportFormat = 'Export format is required';
    }

    // Date validation
    if (formData.dateFrom && formData.dateTo) {
      if (formData.dateFrom > formData.dateTo) {
        newErrors.dateRange = 'Start date must be before end date';
      }
    }

    // Ensure at least one data type is selected for custom exports
    if (formData.exportType === 'custom') {
      const hasSelection =
        formData.includePersonalData ||
        formData.includeAnalytics ||
        formData.includeComments ||
        formData.includeResponses;
      if (!hasSelection) {
        newErrors.dataTypes = 'Select at least one data type for custom export';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const exportData = {
        organization_id: formData.organizationId,
        export_type: formData.exportType,
        export_format: formData.exportFormat,
        date_from: formData.dateFrom?.toISOString(),
        date_to: formData.dateTo?.toISOString(),
        // Data type selection for custom exports
        ...(formData.exportType === 'custom' && {
          include_personal_data: formData.includePersonalData,
          include_analytics: formData.includeAnalytics,
          include_comments: formData.includeComments,
          include_responses: formData.includeResponses
        })
      };

      await onSubmit(exportData);
      handleClose();
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      organizationId: '',
      exportType: 'full',
      exportFormat: 'json',
      dateFrom: null,
      dateTo: null,
      includePersonalData: true,
      includeAnalytics: true,
      includeComments: true,
      includeResponses: true
    });
    setErrors({});
    onClose();
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts fixing it
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Create Manual GDPR Export</DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 2 }}>
          {errors.submit && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.submit}
            </Alert>
          )}

          <Grid container spacing={2}>
            {/* Organization Selection */}
            <Grid item xs={12}>
              <Autocomplete
                options={organizations}
                getOptionLabel={(option) => option.name || option.id}
                value={organizations.find((org) => org.id === formData.organizationId) || null}
                onChange={(_, value) => handleInputChange('organizationId', value?.id || '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Organization"
                    error={!!errors.organizationId}
                    helperText={errors.organizationId}
                    required
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props}>
                    <Box>
                      <Typography variant="body1">{option.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        ID: {option.id}
                      </Typography>
                    </Box>
                  </Box>
                )}
              />
            </Grid>

            {/* Export Type */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!errors.exportType}>
                <InputLabel>Export Type *</InputLabel>
                <Select
                  value={formData.exportType}
                  onChange={(e) => handleInputChange('exportType', e.target.value)}
                  label="Export Type *"
                >
                  {exportTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      <Box>
                        <Typography variant="body1">{type.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {type.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                {errors.exportType && <FormHelperText>{errors.exportType}</FormHelperText>}
              </FormControl>
            </Grid>

            {/* Export Format */}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth error={!!errors.exportFormat}>
                <InputLabel>Export Format *</InputLabel>
                <Select
                  value={formData.exportFormat}
                  onChange={(e) => handleInputChange('exportFormat', e.target.value)}
                  label="Export Format *"
                >
                  {exportFormats.map((format) => (
                    <MenuItem key={format.value} value={format.value}>
                      <Box>
                        <Typography variant="body1">{format.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
                {errors.exportFormat && <FormHelperText>{errors.exportFormat}</FormHelperText>}
              </FormControl>
            </Grid>

            {/* Date Range */}
            <Grid item xs={12}>
              <Typography variant="subtitle2" gutterBottom>
                Date Range (Optional)
              </Typography>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <DatePicker
                      label="From Date"
                      value={formData.dateFrom}
                      onChange={(value) => handleInputChange('dateFrom', value)}
                      maxDate={new Date()}
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <DatePicker
                      label="To Date"
                      value={formData.dateTo}
                      onChange={(value) => handleInputChange('dateTo', value)}
                      maxDate={new Date()}
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </Grid>
                </Grid>
                {errors.dateRange && <FormHelperText error>{errors.dateRange}</FormHelperText>}
              </LocalizationProvider>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Leave blank to export all historical data
              </Typography>
            </Grid>

            {/* Custom Data Selection */}
            {formData.exportType === 'custom' && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Data Types to Include
                </Typography>
                <Box sx={{ pl: 2 }}>
                  {[
                    {
                      key: 'includePersonalData',
                      label: 'Personal Data',
                      description: 'User profiles, settings, preferences'
                    },
                    {
                      key: 'includeAnalytics',
                      label: 'Analytics Data',
                      description: 'Usage metrics, performance data'
                    },
                    {
                      key: 'includeComments',
                      label: 'Comments & Posts',
                      description: 'User-generated content'
                    },
                    {
                      key: 'includeResponses',
                      label: 'AI Responses',
                      description: 'Generated roasts and replies'
                    }
                  ].map((option) => (
                    <Box key={option.key} sx={{ mb: 1 }}>
                      <label>
                        <input
                          type="checkbox"
                          checked={formData[option.key]}
                          onChange={(e) => handleInputChange(option.key, e.target.checked)}
                          style={{ marginRight: 8 }}
                        />
                        <Typography variant="body2" component="span">
                          {option.label}
                        </Typography>
                      </label>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        sx={{ ml: 3 }}
                      >
                        {option.description}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                {errors.dataTypes && (
                  <FormHelperText error sx={{ mt: 1 }}>
                    {errors.dataTypes}
                  </FormHelperText>
                )}
              </Grid>
            )}

            {/* Information Box */}
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Export Information:</strong>
                  <br />
                  • Exports are processed in the background and may take several minutes
                  <br />
                  • You will receive a notification when the export is complete
                  <br />
                  • Download links expire after 24 hours for security
                  <br />• All exports are encrypted and access-logged for compliance
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={submitting}>
          {submitting ? 'Creating Export...' : 'Create Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ManualExportForm;
