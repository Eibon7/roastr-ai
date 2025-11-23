// Widget Registry
import PlanStatusCard from './PlanStatusCard';
import IntegrationsCard from './IntegrationsCard';
import HealthFlagsCard from './HealthFlagsCard';
import ActivityFeedCard from './ActivityFeedCard';
import JobsQueueCard from './JobsQueueCard';
import UsageCostCard from './UsageCostCard';
import LogsTableCard from './LogsTableCard';
import StyleProfileCard from './StyleProfileCard';
import CreditsCard from './CreditsCard';
import AnalysisUsageCard from './AnalysisUsageCard';
import RoastUsageCard from './RoastUsageCard';

export const WIDGETS = {
  planStatus: PlanStatusCard,
  integrations: IntegrationsCard,
  styleProfile: StyleProfileCard,
  health: HealthFlagsCard,
  activity: ActivityFeedCard,
  queue: JobsQueueCard,
  costs: UsageCostCard,
  credits: CreditsCard,
  logs: LogsTableCard,
  analysisUsage: AnalysisUsageCard,
  roastUsage: RoastUsageCard
};

export const DEFAULT_LAYOUT = [
  'planStatus',
  'integrations',
  'styleProfile',
  'health',
  'activity',
  'queue',
  'costs',
  'logs'
];

export const WIDGET_CONFIGS = {
  planStatus: {
    title: 'Plan Status',
    description: 'Current subscription & limits',
    gridCols: 'md:col-span-1'
  },
  integrations: {
    title: 'Integrations',
    description: 'Platform connections',
    gridCols: 'md:col-span-1'
  },
  styleProfile: {
    title: 'Style Profile',
    description: 'AI-generated roast style',
    gridCols: 'md:col-span-1'
  },
  health: {
    title: 'System Health',
    description: 'Service & feature flags',
    gridCols: 'md:col-span-1'
  },
  activity: {
    title: 'Recent Activity',
    description: 'Latest system events',
    gridCols: 'md:col-span-1'
  },
  queue: {
    title: 'Jobs Queue',
    description: 'Background processing',
    gridCols: 'md:col-span-1'
  },
  costs: {
    title: 'Usage & Costs',
    description: 'API calls & billing',
    gridCols: 'md:col-span-1'
  },
  logs: {
    title: 'System Logs',
    description: 'Error & info messages',
    gridCols: 'md:col-span-3'
  },
  analysisUsage: {
    title: 'Analysis Usage',
    description: 'Comments analyzed this month',
    gridCols: 'md:col-span-1'
  },
  roastUsage: {
    title: 'Roast Usage',
    description: 'Roasts generated this month',
    gridCols: 'md:col-span-1'
  }
};
