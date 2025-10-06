import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { LeftSidebar } from './LeftSidebar';
import { HealthPanel } from './HealthPanel';
import { GraphView } from './GraphView';
import { ReportsViewer } from '@components/dashboard/ReportsViewer';
import { NodeDetailsDrawer } from './NodeDetailsDrawer';

type ViewType = 'health' | 'graph' | 'reports';

const LayoutContainer = styled.div`
  width: 100%;
  min-height: 100vh;
  background: #0b0b0d;
  display: grid;
  grid-template-columns: 280px 1fr;
  grid-template-rows: 1fr;
`;

const SidebarWrapper = styled.div`
  grid-column: 1;
  grid-row: 1;
`;

const MainContent = styled.div`
  grid-column: 2;
  grid-row: 1;
  overflow: hidden;
`;

export const CommandCenterLayout: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('graph');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Mock data - will be replaced with real data from hooks
  const [stats, setStats] = useState({
    health: 95.5,
    drift: 12,
    nodes: 13,
    coverage: 78
  });

  const [activities] = useState([
    { timestamp: '18:20', event: 'System validation completed - 13 nodes validated' },
    { timestamp: '18:15', event: 'Health scores updated - Average 95.5/100' },
    { timestamp: '18:10', event: 'Drift analysis completed - 13 nodes low risk' },
    { timestamp: '18:05', event: 'DependencyGraph component updated' },
    { timestamp: '18:00', event: 'GDD runtime validation passed' },
  ]);

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedNode(null), 300); // Wait for animation
  };

  // Mock node data - will be replaced with real data from API
  const getNodeData = (nodeId: string | null) => {
    if (!nodeId) return undefined;

    return {
      name: nodeId,
      filePath: `docs/nodes/${nodeId}.md`,
      status: 'healthy' as const,
      healthScore: 95,
      coverage: 85,
      lastUpdated: '2 hours ago',
      dependsOn: ['roast', 'persona'],
      usedBy: ['analytics', 'trainer'],
      recentActivity: [
        { timestamp: '18:20', event: 'Node validation passed' },
        { timestamp: '18:15', event: 'Health score updated: 95/100' },
      ]
    };
  };

  const renderMainContent = () => {
    switch (activeView) {
      case 'health':
        return <HealthPanel stats={stats} activities={activities} />;
      case 'graph':
        return <GraphView onNodeClick={handleNodeClick} />;
      case 'reports':
        return <ReportsViewer />;
      default:
        return <GraphView onNodeClick={handleNodeClick} />;
    }
  };

  return (
    <LayoutContainer>
      <SidebarWrapper>
        <LeftSidebar
          activeView={activeView}
          onViewChange={setActiveView}
          stats={stats}
        />
      </SidebarWrapper>

      <MainContent>
        {renderMainContent()}
      </MainContent>

      <NodeDetailsDrawer
        nodeId={selectedNode}
        open={drawerOpen}
        onClose={handleDrawerClose}
        nodeData={getNodeData(selectedNode)}
        onNodeClick={handleNodeClick}
      />
    </LayoutContainer>
  );
};
