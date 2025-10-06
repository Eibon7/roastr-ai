import React from 'react';
import styled from 'styled-components';
import { ActivityLogItem } from '@components/dashboard/ActivityLogItem';

interface HealthPanelProps {
  stats: {
    health: number;
    drift: number;
    nodes: number;
    coverage: number;
  };
  activities: Array<{
    timestamp: string;
    event: string;
  }>;
}

const PanelContainer = styled.div`
  width: 100%;
  height: 100%;
  padding: 24px;
  overflow-y: auto;
`;

const Section = styled.div`
  margin-bottom: 32px;
`;

const SectionTitle = styled.h2`
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #bdbdbd;
  margin: 0 0 24px 0;
`;

const ActivityLog = styled.div`
  background: #1f1d20;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  padding: 24px;
  max-height: 400px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #0b0b0d;
  }

  &::-webkit-scrollbar-thumb {
    background: #50fa7b;
    border-radius: 4px;
  }
`;

const ActivityTitle = styled.h3`
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8a8a8a;
  margin: 0 0 16px 0;
`;

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 32px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: #8a8a8a;
`;

export const HealthPanel: React.FC<HealthPanelProps> = ({
  stats,
  activities
}) => {
  return (
    <PanelContainer>
      <Section>
        <SectionTitle>Recent Activity</SectionTitle>
        <ActivityLog>
          <ActivityTitle>System Validation Events</ActivityTitle>
          {activities.length > 0 ? (
            <ActivityList>
              {activities.map((activity, index) => (
                <ActivityLogItem
                  key={index}
                  timestamp={activity.timestamp}
                  event={activity.event}
                  isLast={index === activities.length - 1}
                />
              ))}
            </ActivityList>
          ) : (
            <EmptyState>No recent activity</EmptyState>
          )}
        </ActivityLog>
      </Section>
    </PanelContainer>
  );
};
