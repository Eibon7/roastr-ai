import React, { useState } from 'react';
import styled from 'styled-components';
import { LeftSidebar } from './LeftSidebar';
import { HealthPanel } from './HealthPanel';
import { GraphView } from './GraphView';
import { ReportsViewer } from '@components/dashboard/ReportsViewer';
import { NodeDetailsDrawer } from './NodeDetailsDrawer';
import { useGDDData } from '@hooks/useGDDData';

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

  // Fetch real GDD data
  const { health, drift, nodes, coverage, loading, error, lastUpdated, refresh } = useGDDData();

  // Map to stats object for compatibility
  const stats = {
    health,
    drift,
    nodes,
    coverage
  };

  // Generate recent activities from real data
  const activities = [
    { timestamp: lastUpdated, event: `System validation completed - ${nodes} nodes validated` },
    { timestamp: lastUpdated, event: `Health scores updated - Average ${health.toFixed(1)}/100` },
    { timestamp: lastUpdated, event: `Drift analysis completed - ${drift}% average risk` },
    { timestamp: lastUpdated, event: `Coverage at ${coverage}% across all nodes` },
  ];

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
    // Show loading state
    if (loading && nodes === 0) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#bdbdbd',
          fontFamily: 'JetBrains Mono, monospace'
        }}>
          Loading GDD data...
        </div>
      );
    }

    // Show error state
    if (error) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#ff5555',
          fontFamily: 'JetBrains Mono, monospace',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div>⚠️ Failed to load GDD data</div>
          <div style={{ fontSize: '14px', color: '#8a8a8a' }}>{error}</div>
          <button
            onClick={refresh}
            style={{
              background: '#1f1d20',
              border: '1px solid #50fa7b',
              borderRadius: '4px',
              padding: '8px 16px',
              color: '#50fa7b',
              cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace'
            }}
          >
            Retry
          </button>
        </div>
      );
    }

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
    <LayoutContainer data-testid="dashboard-layout">
      <SidebarWrapper>
        <LeftSidebar
          activeView={activeView}
          onViewChange={setActiveView}
          stats={stats}
        />
      </SidebarWrapper>

      <main data-testid="main-content">
        <MainContent>
          {renderMainContent()}
        </MainContent>
      </main>

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
