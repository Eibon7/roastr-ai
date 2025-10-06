import React from 'react';
import styled from 'styled-components';

const DashboardContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.background};
  padding: ${({ theme }) => theme.spacing(6)};
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
`;

const Subtitle = styled.p`
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  color: ${({ theme }) => theme.colors.textSecondary};
  animation: ${({ theme }) => theme.animations.fadeIn};
  animation-delay: 0.1s;
  animation-fill-mode: both;
`;

const StatusIndicator = styled.div<{ status: 'healthy' | 'warning' | 'critical' }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(3)} ${theme.spacing(4)}`};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  margin-top: ${({ theme }) => theme.spacing(6)};
  animation: ${({ theme }) => theme.animations.fadeIn};
  animation-delay: 0.2s;
  animation-fill-mode: both;

  &::before {
    content: '';
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: ${({ theme, status }) => {
      switch (status) {
        case 'healthy':
          return theme.colors.statusHealthy;
        case 'warning':
          return theme.colors.statusWarning;
        case 'critical':
          return theme.colors.statusCritical;
        default:
          return theme.colors.statusHealthy;
      }
    }};
    border: 2px solid ${({ theme, status }) => {
      switch (status) {
        case 'healthy':
          return theme.colors.statusHealthy;
        case 'warning':
          return theme.colors.statusWarning;
        case 'critical':
          return theme.colors.statusCritical;
        default:
          return theme.colors.statusHealthy;
      }
    }};
    box-shadow: ${({ theme }) => theme.shadows.glow};
    animation: pulse 1.5s ease-in-out infinite;
  }
`;

const StatusText = styled.span`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.h2};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
`;

const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: ${({ theme }) => theme.spacing(6)};
  margin-top: ${({ theme }) => theme.spacing(8)};
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
  font-family: ${({ theme }) => theme.typography.fontFamily.sans};
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

function GDDDashboard() {
  return (
    <DashboardContainer id="main-content">
      <Header>
        <Title>GDD SYSTEM DASHBOARD</Title>
        <Subtitle>Graph-Driven Development Monitoring & Administration</Subtitle>
        <StatusIndicator status="healthy">
          <StatusText>SYSTEM STATUS: HEALTHY</StatusText>
        </StatusIndicator>
      </Header>

      <GridContainer>
        <Card>
          <CardTitle>Overview Panel</CardTitle>
          <CardContent>
            <PlaceholderText>
              System health metrics, drift predictions, and recent activity will be displayed here.
            </PlaceholderText>
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Node Explorer</CardTitle>
          <CardContent>
            <PlaceholderText>
              Interactive table of all 13 GDD nodes with search and filtering capabilities.
            </PlaceholderText>
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Dependency Graph</CardTitle>
          <CardContent>
            <PlaceholderText>
              D3.js force-directed graph visualization of node dependencies.
            </PlaceholderText>
          </CardContent>
        </Card>

        <Card>
          <CardTitle>Reports Viewer</CardTitle>
          <CardContent>
            <PlaceholderText>
              Markdown reports: Validation, Health, Drift, and Auto-Repair.
            </PlaceholderText>
          </CardContent>
        </Card>
      </GridContainer>
    </DashboardContainer>
  );
}

export default GDDDashboard;
