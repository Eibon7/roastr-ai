import React from 'react';
import styled from 'styled-components';
import { DependencyGraph } from '@components/dashboard/DependencyGraph';

interface GraphViewProps {
  onNodeClick?: (nodeId: string) => void;
}

const GraphContainer = styled.div`
  width: 100%;
  height: 100%;
  padding: 24px;
  overflow: hidden;
`;

const GraphWrapper = styled.div`
  width: 100%;
  height: 100%;
  background: #1f1d20;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  overflow: hidden;
`;

export const GraphView: React.FC<GraphViewProps> = ({ onNodeClick }) => {
  return (
    <GraphContainer>
      <GraphWrapper>
        <DependencyGraph />
      </GraphWrapper>
    </GraphContainer>
  );
};
