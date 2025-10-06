import React from 'react';
import styled from 'styled-components';
import { Overview } from '@components/dashboard/Overview';
import { NodeExplorer } from '@components/dashboard/NodeExplorer';
import { DependencyGraph } from '@components/dashboard/DependencyGraph';
import { ReportsViewer } from '@components/dashboard/ReportsViewer';

const DashboardContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.background};
  padding: ${({ theme }) => theme.spacing(6)};

  @media (max-width: 768px) {
    padding: ${({ theme }) => theme.spacing(4)};
  }
`;

const Header = styled.header`
  margin-bottom: ${({ theme }) => theme.spacing(8)};
`;

const Title = styled.h1`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.h1};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  letter-spacing: -0.02em;
  animation: ${({ theme }) => theme.animations.slideIn};

  @media (max-width: 768px) {
    font-size: ${({ theme }) => theme.typography.fontSize.xl};
  }
`;

const Subtitle = styled.p`
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  color: ${({ theme }) => theme.colors.textSecondary};
  animation: ${({ theme }) => theme.animations.fadeIn};
  animation-delay: 0.1s;
  animation-fill-mode: both;

  @media (max-width: 768px) {
    font-size: ${({ theme }) => theme.typography.fontSize.md};
  }
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing(6)};
  margin-top: ${({ theme }) => theme.spacing(8)};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: ${({ theme }) => theme.spacing(4)};
  }
`;

const Card = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing(6)};
  box-shadow: ${({ theme }) => theme.shadows.md};
  transition: all 0.15s ease;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: ${({ theme }) => theme.shadows.glow};
  }
`;

const CardTitle = styled.h3`
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.h3};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const CardContent = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: ${({ theme }) => theme.typography.lineHeight.relaxed};
`;

const PlaceholderText = styled.div`
  padding: ${({ theme }) => theme.spacing(4)};
  text-align: center;
  color: ${({ theme }) => theme.colors.textDisabled};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  background: ${({ theme }) => theme.colors.background};
`;

const ComingSoonBadge = styled.span`
  display: inline-block;
  margin-left: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(2)}`};
  background: ${({ theme }) => theme.colors.primary}20;
  color: ${({ theme }) => theme.colors.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

function GDDDashboard() {
  return (
    <DashboardContainer id="main-content">
      <Header>
        <Title>GDD SYSTEM DASHBOARD</Title>
        <Subtitle>Graph-Driven Development Monitoring & Administration</Subtitle>
      </Header>

      {/* Overview Panel - FUNCTIONAL */}
      <Overview />

      {/* Node Explorer - FUNCTIONAL */}
      <NodeExplorer />

      {/* Dependency Graph - FUNCTIONAL */}
      <DependencyGraph />

      {/* Reports Viewer - FUNCTIONAL */}
      <ReportsViewer />
    </DashboardContainer>
  );
}

export default GDDDashboard;
