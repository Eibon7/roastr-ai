import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  Storage as StorageIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  CloudDownload as CloudDownloadIcon,
  Security as SecurityIcon
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';

/**
 * Export Statistics component showing comprehensive analytics for GDPR exports
 * Includes charts, metrics, and performance data
 */
const ExportStatistics = () => {
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [lastRefresh, setLastRefresh] = useState(null);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  useEffect(() => {
    loadStatistics();
  }, [timeRange]);

  const loadStatistics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/admin/exports/statistics?range=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load statistics: ${response.status}`);
      }

      const data = await response.json();
      setStatistics(data.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error loading statistics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const getSuccessRate = (completed, total) => {
    if (!total) return 0;
    return Math.round((completed / total) * 100);
  };

  if (loading && !statistics) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Export Statistics
        </Typography>
        <LinearProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Export Statistics
        </Typography>
        <Alert severity="error">
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Export Statistics
        </Typography>
        
        <Box display="flex" alignItems="center" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              label="Time Range"
            >
              <MenuItem value="7d">Last 7 days</MenuItem>
              <MenuItem value="30d">Last 30 days</MenuItem>
              <MenuItem value="90d">Last 90 days</MenuItem>
              <MenuItem value="365d">Last year</MenuItem>
            </Select>
          </FormControl>
          
          {lastRefresh && (
            <Typography variant="body2" color="text.secondary">
              Updated: {lastRefresh.toLocaleTimeString()}
            </Typography>
          )}
          
          <Tooltip title="Refresh statistics">
            <IconButton onClick={loadStatistics} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {statistics && (
        <Grid container spacing={3}>
          {/* Key Metrics Cards */}
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <AssessmentIcon color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">Total Exports</Typography>
                </Box>
                <Typography variant="h3" color="primary">
                  {statistics.overview?.total_exports || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Success rate: {getSuccessRate(
                    statistics.overview?.completed_exports, 
                    statistics.overview?.total_exports
                  )}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <StorageIcon color="success" sx={{ mr: 1 }} />
                  <Typography variant="h6">Data Volume</Typography>
                </Box>
                <Typography variant="h3" color="success.main">
                  {formatBytes(statistics.overview?.total_data_exported)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {statistics.overview?.total_records?.toLocaleString()} records
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <ScheduleIcon color="warning" sx={{ mr: 1 }} />
                  <Typography variant="h6">Avg Processing</Typography>
                </Box>
                <Typography variant="h3" color="warning.main">
                  {formatDuration(statistics.overview?.avg_processing_time)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Per export job
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={1}>
                  <CloudDownloadIcon color="info" sx={{ mr: 1 }} />
                  <Typography variant="h6">Downloads</Typography>
                </Box>
                <Typography variant="h3" color="info.main">
                  {statistics.overview?.total_downloads || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {statistics.overview?.unique_downloaders || 0} unique users
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Export Types Pie Chart */}
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 2, height: 350 }}>
              <Typography variant="h6" gutterBottom>
                Export Types Distribution
              </Typography>
              
              {statistics.export_types && (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statistics.export_types}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {statistics.export_types.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Export Status Distribution */}
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 2, height: 350 }}>
              <Typography variant="h6" gutterBottom>
                Export Status Overview
              </Typography>
              
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                {statistics.status_distribution?.map((status, index) => (
                  <Chip
                    key={status.status}
                    label={`${status.status}: ${status.count}`}
                    color={
                      status.status === 'completed' ? 'success' :
                      status.status === 'failed' ? 'error' :
                      status.status === 'processing' ? 'warning' : 'default'
                    }
                  />
                ))}
              </Box>

              {statistics.status_distribution && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={statistics.status_distribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Export Timeline */}
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ p: 2, height: 400 }}>
              <Typography variant="h6" gutterBottom>
                Export Activity Timeline
              </Typography>
              
              {statistics.timeline && (
                <ResponsiveContainer width="100%" height={340}>
                  <AreaChart data={statistics.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString()}
                    />
                    <YAxis />
                    <RechartsTooltip 
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                    />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="exports" 
                      stackId="1"
                      stroke="#8884d8" 
                      fill="#8884d8"
                      name="Total Exports"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="completed" 
                      stackId="2"
                      stroke="#82ca9d" 
                      fill="#82ca9d"
                      name="Completed"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Paper>
          </Grid>

          {/* Performance Metrics */}
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                Performance Metrics
              </Typography>
              
              {statistics.performance && (
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Average File Size</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatBytes(statistics.performance.avg_file_size)}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Largest Export</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatBytes(statistics.performance.max_file_size)}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Fastest Export</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatDuration(statistics.performance.min_processing_time)}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Slowest Export</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatDuration(statistics.performance.max_processing_time)}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Retry Rate</Typography>
                    <Typography variant="body2" fontWeight="bold" color={
                      statistics.performance.retry_rate > 10 ? 'error' : 'success'
                    }>
                      {statistics.performance.retry_rate}%
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>
          </Grid>

          {/* Security & Compliance */}
          <Grid item xs={12} md={6}>
            <Paper elevation={1} sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                <SecurityIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Security & Compliance
              </Typography>
              
              {statistics.security && (
                <Box>
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Encrypted Exports</Typography>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      {statistics.security.encrypted_exports_percentage}%
                    </Typography>
                  </Box>
                  
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Access Log Coverage</Typography>
                    <Typography variant="body2" fontWeight="bold" color="success.main">
                      {statistics.security.access_log_coverage}%
                    </Typography>
                  </Box>
                  
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Expired Downloads</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {statistics.security.expired_downloads}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Average Download Delay</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {formatDuration(statistics.security.avg_download_delay)}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="body2">Failed Access Attempts</Typography>
                    <Typography variant="body2" fontWeight="bold" color={
                      statistics.security.failed_access_attempts > 0 ? 'warning.main' : 'success.main'
                    }>
                      {statistics.security.failed_access_attempts}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default ExportStatistics;