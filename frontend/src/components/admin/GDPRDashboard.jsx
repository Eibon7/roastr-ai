import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
  Container
} from '@mui/material';
import {
  CloudDownload as CloudDownloadIcon,
  Schedule as ScheduleIcon,
  Assessment as AssessmentIcon,
  Security as SecurityIcon,
  BarChart as BarChartIcon
} from '@mui/icons-material';
import GDPRExportList from './GDPRExportList';
import RetentionJobList from './RetentionJobList';
import ComplianceDashboard from './ComplianceDashboard';
import ExportStatistics from './ExportStatistics';

/**
 * Main GDPR Dashboard component providing comprehensive data management interface
 * Includes tabs for exports, retention jobs, compliance monitoring, and statistics
 */
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`gdpr-tabpanel-${index}`}
      aria-labelledby={`gdpr-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index) {
  return {
    id: `gdpr-tab-${index}`,
    'aria-controls': `gdpr-tabpanel-${index}`,
  };
}

const GDPRDashboard = () => {
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      {/* Header */}
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          GDPR Data Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive GDPR compliance dashboard for export management, data retention, and audit monitoring
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper elevation={1}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={currentTab} 
            onChange={handleTabChange} 
            aria-label="GDPR Dashboard tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab 
              label="Data Exports" 
              icon={<CloudDownloadIcon />}
              iconPosition="start"
              {...a11yProps(0)} 
            />
            <Tab 
              label="Retention Jobs" 
              icon={<ScheduleIcon />}
              iconPosition="start"
              {...a11yProps(1)} 
            />
            <Tab 
              label="Compliance" 
              icon={<SecurityIcon />}
              iconPosition="start"
              {...a11yProps(2)} 
            />
            <Tab 
              label="Statistics" 
              icon={<BarChartIcon />}
              iconPosition="start"
              {...a11yProps(3)} 
            />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={currentTab} index={0}>
          <GDPRExportList />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <RetentionJobList />
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <ComplianceDashboard />
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <ExportStatistics />
        </TabPanel>
      </Paper>

      {/* Footer Information */}
      <Box mt={3}>
        <Paper elevation={0} sx={{ p: 2, backgroundColor: 'grey.50' }}>
          <Typography variant="body2" color="text.secondary">
            <strong>GDPR Compliance Information:</strong>
            {' '}This dashboard provides tools for managing data exports (Article 20), 
            implementing data retention policies (Article 17), and monitoring compliance status. 
            All operations are logged for audit purposes and data is encrypted in transit and at rest.
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

export default GDPRDashboard;