import React from 'react';
import styled from 'styled-components';
import type { HealthStats } from '@/types/dashboard';

type ViewType = 'health' | 'graph' | 'reports';

interface LeftSidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  stats: HealthStats;
}

const SidebarContainer = styled.div`
  width: 280px;
  height: 100%;
  background: #1f1d20;
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`;

const Section = styled.div`
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const SectionTitle = styled.h3`
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8a8a8a;
  margin: 0 0 16px 0;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const StatLabel = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8a8a8a;
`;

const StatValue = styled.div<{ $color: string }>`
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: ${({ $color }) => $color};
`;

const NavMenu = styled.nav`
  padding: 16px 0;
`;

const NavItem = styled.button<{ $active: boolean }>`
  width: 100%;
  height: 48px;
  padding: 0 24px;
  background: ${({ $active }) => ($active ? 'rgba(80, 250, 123, 0.1)' : 'transparent')};
  border: none;
  border-left: ${({ $active }) => ($active ? '3px solid #50fa7b' : '2px solid transparent')};
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  color: ${({ $active }) => ($active ? '#50fa7b' : '#bdbdbd')};
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.05);
    border-left-color: ${({ $active }) => ($active ? '#50fa7b' : 'rgba(80, 250, 123, 0.3)')};
  }

  &:focus-visible {
    outline: 2px solid #50fa7b;
    outline-offset: -2px;
  }
`;

const DisabledNavItem = styled(NavItem).attrs({ 'aria-disabled': true })`
  color: #bdbdbd;
  opacity: 1;
  cursor: not-allowed;
  pointer-events: none;

  &:hover {
    background: transparent;
    border-left-color: transparent;
  }
`;

/**
 * Determines the color of a stat value based on its score and type
 * @param value - The numeric value to evaluate (0-100)
 * @param isRisk - If true, lower values are better (drift risk). If false, higher values are better (health)
 * @returns Color hex code for the stat value
 */
const getStatColor = (value: number, isRisk: boolean = false): string => {
  if (isRisk) {
    if (value <= 30) return '#50fa7b';
    if (value <= 60) return '#f1fa8c';
    return '#ff5555';
  }
  if (value >= 80) return '#50fa7b';
  if (value >= 50) return '#f1fa8c';
  return '#ff5555';
};

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ activeView, onViewChange, stats }) => {
  return (
    <SidebarContainer data-testid="left-sidebar">
      <Section data-testid="system-status">
        <SectionTitle>System Status</SectionTitle>
        <StatsGrid data-testid="stats-grid">
          <StatItem data-testid="stat-health">
            <StatLabel>Health</StatLabel>
            <StatValue $color={getStatColor(stats.health)}>{stats.health.toFixed(0)}</StatValue>
          </StatItem>
          <StatItem data-testid="stat-drift">
            <StatLabel>Drift</StatLabel>
            <StatValue $color={getStatColor(stats.drift, true)}>{stats.drift.toFixed(0)}</StatValue>
          </StatItem>
          <StatItem data-testid="stat-nodes">
            <StatLabel>Nodes</StatLabel>
            <StatValue $color="#50fa7b">{stats.nodes}</StatValue>
          </StatItem>
          <StatItem data-testid="stat-coverage">
            <StatLabel>Coverage</StatLabel>
            <StatValue $color={getStatColor(stats.coverage)}>
              {stats.coverage.toFixed(0)}%
            </StatValue>
          </StatItem>
        </StatsGrid>
      </Section>

      <NavMenu data-testid="nav-menu">
        <NavItem
          $active={activeView === 'health'}
          onClick={() => onViewChange('health')}
          aria-current={activeView === 'health' ? 'page' : undefined}
          data-testid="nav-health"
        >
          Health Panel
        </NavItem>
        <NavItem
          $active={activeView === 'graph'}
          onClick={() => onViewChange('graph')}
          aria-current={activeView === 'graph' ? 'page' : undefined}
          data-testid="nav-graph"
        >
          System Graph
        </NavItem>
        <NavItem
          $active={activeView === 'reports'}
          onClick={() => onViewChange('reports')}
          aria-current={activeView === 'reports' ? 'page' : undefined}
          data-testid="nav-reports"
        >
          Reports
        </NavItem>
        <DisabledNavItem
          as="div"
          $active={false}
          title="Coming soon"
          data-testid="nav-feature-flags"
        >
          Feature Flags
        </DisabledNavItem>
        <DisabledNavItem as="div" $active={false} title="Coming soon" data-testid="nav-user-search">
          User Search
        </DisabledNavItem>
        <DisabledNavItem
          as="div"
          $active={false}
          title="Coming soon"
          data-testid="nav-release-panel"
        >
          Release Panel
        </DisabledNavItem>
      </NavMenu>
    </SidebarContainer>
  );
};
