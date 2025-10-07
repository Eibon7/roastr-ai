import React from 'react';
import styled from 'styled-components';
import { useGDDHealth } from '@hooks/useGDDHealth';
import { useGDDDrift } from '@hooks/useGDDDrift';
import { useGDDStatus } from '@hooks/useGDDStatus';
import { formatDistanceToNow } from 'date-fns';

const OverviewContainer = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing(6)};
  box-shadow: ${({ theme }) => theme.shadows.md};
  animation: ${({ theme }) => theme.animations.slideIn};
`;

const StatusHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing(6)};
  padding-bottom: ${({ theme }) => theme.spacing(4)};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
`;

const StatusIndicator = styled.div<{ status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(3)};

  &::before {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${({ theme, status }) => {
      switch (status) {
        case 'HEALTHY':
          return theme.colors.statusHealthy;
        case 'DEGRADED':
          return theme.colors.statusWarning;
        case 'CRITICAL':
          return theme.colors.statusCritical;
        default:
          return theme.colors.statusHealthy;
      }
    }};
    border: 2px solid ${({ theme, status }) => {
      switch (status) {
        case 'HEALTHY':
          return theme.colors.statusHealthy;
        case 'DEGRADED':
          return theme.colors.statusWarning;
        case 'CRITICAL':
          return theme.colors.statusCritical;
        default:
          return theme.colors.statusHealthy;
      }
    }};
    box-shadow: ${({ theme }) => theme.shadows.glow};
    animation: pulse 1.5s ease-in-out infinite;
  }
`;

const StatusText = styled.h2`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.h2};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
`;

const LastUpdated = styled.span`
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing(4)};
  margin-bottom: ${({ theme }) => theme.spacing(6)};
`;

const MetricCard = styled.div`
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing(4)};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    transform: translateY(-2px);
    box-shadow: ${({ theme }) => theme.shadows.glow};
  }
`;

const MetricLabel = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const MetricValue = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize['2xl']};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const MetricSubtext = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textDisabled};
`;

const ActivitySection = styled.div`
  margin-top: ${({ theme }) => theme.spacing(6)};
  padding-top: ${({ theme }) => theme.spacing(4)};
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
`;

const ActivityTitle = styled.h3`
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const ActivityList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const ActivityItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(3)};
  padding: ${({ theme }) => theme.spacing(3)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  transition: all 0.1s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
    border-left: 3px solid ${({ theme }) => theme.colors.primary};
  }

  &::before {
    content: '•';
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.typography.fontSize.lg};
    line-height: 1;
  }
`;

const ActivityText = styled.span`
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  flex: 1;
`;

const LoadingSpinner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(8)};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
`;

const ErrorMessage = styled.div`
  padding: ${({ theme }) => theme.spacing(4)};
  background: ${({ theme }) => theme.colors.statusCritical}15;
  border: 1px solid ${({ theme }) => theme.colors.statusCritical};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.statusCritical};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

/**
 * Render the dashboard overview card displaying GDD health, drift, and status metrics.
 *
 * Shows a loading spinner while any GDD data is being fetched, a styled error banner if health data fails to load, and nothing if health data is absent after loading. When data is available, displays overall system status with last-updated time, primary metric cards (health score, drift risk, total nodes, coverage), and a recent activity list with conditional entries for degraded or critical node counts.
 *
 * @returns The overview component element containing status, metrics, and recent activity.
 */
export function Overview() {
  const { data: healthData, isLoading: healthLoading, error: healthError } = useGDDHealth();
  const { data: driftData, isLoading: driftLoading } = useGDDDrift();
  const { data: statusData, isLoading: statusLoading } = useGDDStatus();

  const isLoading = healthLoading || driftLoading || statusLoading;

  if (isLoading) {
    return (
      <OverviewContainer>
        <LoadingSpinner>Loading GDD data...</LoadingSpinner>
      </OverviewContainer>
    );
  }

  if (healthError) {
    return (
      <OverviewContainer>
        <ErrorMessage>
          ⚠️ Failed to load GDD health data. Make sure the backend is running and JSON files are generated.
        </ErrorMessage>
      </OverviewContainer>
    );
  }

  if (!healthData) {
    return null;
  }

  const status = healthData.overall_status;
  const lastUpdated = formatDistanceToNow(new Date(healthData.generated_at), { addSuffix: true });

  // Calculate average coverage from node breakdown
  const coverageValues = Object.values(healthData.nodes).map(node => node.breakdown.coverageEvidence);
  const avgCoverage = Math.round(coverageValues.reduce((a, b) => a + b, 0) / coverageValues.length);

  return (
    <OverviewContainer>
      <StatusHeader>
        <StatusIndicator status={status}>
          <StatusText>SYSTEM STATUS: {status}</StatusText>
        </StatusIndicator>
        <LastUpdated>Last updated {lastUpdated}</LastUpdated>
      </StatusHeader>

      <MetricsGrid>
        <MetricCard>
          <MetricLabel>Health Score</MetricLabel>
          <MetricValue>{healthData.average_score.toFixed(1)}</MetricValue>
          <MetricSubtext>/100 average</MetricSubtext>
        </MetricCard>

        <MetricCard>
          <MetricLabel>Drift Risk</MetricLabel>
          <MetricValue>{driftData?.average_drift_risk || 0}</MetricValue>
          <MetricSubtext>/100 risk level</MetricSubtext>
        </MetricCard>

        <MetricCard>
          <MetricLabel>Total Nodes</MetricLabel>
          <MetricValue>{healthData.node_count}</MetricValue>
          <MetricSubtext>{healthData.healthy_count} healthy</MetricSubtext>
        </MetricCard>

        <MetricCard>
          <MetricLabel>Coverage</MetricLabel>
          <MetricValue>{avgCoverage}%</MetricValue>
          <MetricSubtext>average across nodes</MetricSubtext>
        </MetricCard>
      </MetricsGrid>

      <ActivitySection>
        <ActivityTitle>Recent Activity</ActivityTitle>
        <ActivityList>
          <ActivityItem>
            <ActivityText>
              System validation completed - {statusData?.nodes_validated || 0} nodes validated
            </ActivityText>
          </ActivityItem>
          <ActivityItem>
            <ActivityText>
              Health scores updated - Average: {healthData.average_score.toFixed(1)}/100
            </ActivityText>
          </ActivityItem>
          <ActivityItem>
            <ActivityText>
              Drift analysis completed - {driftData?.healthy_count || 0} nodes low risk
            </ActivityText>
          </ActivityItem>
          {healthData.degraded_count > 0 && (
            <ActivityItem>
              <ActivityText>
                ⚠️ {healthData.degraded_count} node(s) need attention (degraded status)
              </ActivityText>
            </ActivityItem>
          )}
          {healthData.critical_count > 0 && (
            <ActivityItem>
              <ActivityText>
                🚨 {healthData.critical_count} node(s) require immediate action (critical status)
              </ActivityText>
            </ActivityItem>
          )}
        </ActivityList>
      </ActivitySection>
    </OverviewContainer>
  );
}