import React from 'react';
import styled from 'styled-components';
import { StatusCard } from '@components/dashboard/StatusCard';

interface SystemStatusBarProps {
  healthScore: number;
  driftRisk: number;
  totalNodes: number;
  coverage: number;
  lastUpdated: string;
  onRefresh: () => void;
}

const StatusBarContainer = styled.div`
  height: 80px;
  background: #1f1d20;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
`;

const CardsContainer = styled.div`
  display: flex;
  gap: 24px;
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

const LastUpdated = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #8a8a8a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const RefreshButton = styled.button`
  height: 40px;
  padding: 0 16px;
  background: transparent;
  border: 1px solid #50fa7b;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  color: #50fa7b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(80, 250, 123, 0.1);
    box-shadow: 0 0 20px rgba(80, 250, 123, 0.3);
  }

  &:active {
    background: rgba(80, 250, 123, 0.2);
  }

  &:focus-visible {
    outline: 2px solid #50fa7b;
    outline-offset: 2px;
  }
`;

export const SystemStatusBar: React.FC<SystemStatusBarProps> = ({
  healthScore,
  driftRisk,
  totalNodes,
  coverage,
  lastUpdated,
  onRefresh
}) => {
  const getHealthStatus = (score: number) => {
    if (score >= 80) return 'healthy';
    if (score >= 50) return 'warning';
    return 'critical';
  };

  const getDriftStatus = (risk: number) => {
    if (risk <= 30) return 'healthy';
    if (risk <= 60) return 'warning';
    return 'critical';
  };

  return (
    <StatusBarContainer>
      <CardsContainer>
        <StatusCard
          label="Health Score"
          value={healthScore}
          max={100}
          status={getHealthStatus(healthScore)}
        />
        <StatusCard
          label="Drift Risk"
          value={driftRisk}
          max={100}
          status={getDriftStatus(driftRisk)}
        />
        <StatusCard label="Total Nodes" value={totalNodes} status="healthy" />
        <StatusCard label="Coverage" value={coverage} unit="%" status={getHealthStatus(coverage)} />
      </CardsContainer>

      <RightSection>
        <LastUpdated>Last Updated: {lastUpdated}</LastUpdated>
        <RefreshButton onClick={onRefresh} aria-label="Refresh data">
          Refresh
        </RefreshButton>
      </RightSection>
    </StatusBarContainer>
  );
};
