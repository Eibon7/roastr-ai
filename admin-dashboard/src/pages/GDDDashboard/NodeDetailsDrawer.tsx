import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { NodeChip } from '@components/dashboard/NodeChip';
import { ActivityLogItem } from '@components/dashboard/ActivityLogItem';

interface NodeDetailsDrawerProps {
  nodeId: string | null;
  open: boolean;
  onClose: () => void;
  nodeData?: {
    name: string;
    filePath: string;
    status: 'healthy' | 'warning' | 'critical';
    healthScore: number;
    coverage: number;
    lastUpdated: string;
    dependsOn: string[];
    usedBy: string[];
    recentActivity: Array<{
      timestamp: string;
      event: string;
    }>;
  };
  onNodeClick?: (nodeId: string) => void;
}

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;
`;

const DrawerContainer = styled(motion.div)`
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: #0b0b0d;
  box-shadow: -10px 0 30px rgba(0, 0, 0, 0.8);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const DrawerHeader = styled.div`
  padding: 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const NodeName = styled.h2`
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 600;
  color: #bdbdbd;
  margin: 0;
`;

const CloseButton = styled.button`
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: #bdbdbd;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: #50fa7b;
    color: #50fa7b;
  }
`;

const DrawerContent = styled.div`
  flex: 1;
  padding: 24px;
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

const Section = styled.div`
  margin-bottom: 24px;
`;

const SectionTitle = styled.h3`
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8a8a8a;
  margin: 0 0 12px 0;
`;

const MetadataGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
`;

const MetadataItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const MetadataLabel = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8a8a8a;
`;

const MetadataValue = styled.div<{ $color?: string }>`
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: ${({ $color }) => $color || '#bdbdbd'};
`;

const ChipsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const FilePath = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #8a8a8a;
  word-break: break-all;
`;

const ActionButton = styled.button`
  width: 100%;
  height: 48px;
  background: transparent;
  border: 1px solid #50fa7b;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: #50fa7b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: rgba(80, 250, 123, 0.1);
  }
`;

const ActivityContainer = styled.div`
  max-height: 200px;
  overflow-y: auto;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #8a8a8a;
`;

export const NodeDetailsDrawer: React.FC<NodeDetailsDrawerProps> = ({
  nodeId,
  open,
  onClose,
  nodeData,
  onNodeClick
}) => {
  const statusColors = {
    healthy: '#50fa7b',
    warning: '#f1fa8c',
    critical: '#ff5555'
  };

  if (!nodeData) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <Overlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <DrawerContainer
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            <DrawerHeader>
              <NodeName id="drawer-title">{nodeData.name}</NodeName>
              <CloseButton onClick={onClose} aria-label="Close drawer">
                ✕
              </CloseButton>
            </DrawerHeader>

            <DrawerContent>
              <Section>
                <SectionTitle>Metadata</SectionTitle>
                <MetadataGrid>
                  <MetadataItem>
                    <MetadataLabel>Status</MetadataLabel>
                    <MetadataValue $color={statusColors[nodeData.status]}>
                      {nodeData.status.toUpperCase()}
                    </MetadataValue>
                  </MetadataItem>
                  <MetadataItem>
                    <MetadataLabel>Health Score</MetadataLabel>
                    <MetadataValue $color={statusColors[nodeData.status]}>
                      {nodeData.healthScore}/100
                    </MetadataValue>
                  </MetadataItem>
                  <MetadataItem>
                    <MetadataLabel>Coverage</MetadataLabel>
                    <MetadataValue>{nodeData.coverage}%</MetadataValue>
                  </MetadataItem>
                  <MetadataItem>
                    <MetadataLabel>Last Updated</MetadataLabel>
                    <MetadataValue>{nodeData.lastUpdated}</MetadataValue>
                  </MetadataItem>
                </MetadataGrid>
              </Section>

              <Section>
                <SectionTitle>File Path</SectionTitle>
                <FilePath>{nodeData.filePath}</FilePath>
              </Section>

              {nodeData.dependsOn.length > 0 && (
                <Section>
                  <SectionTitle>Depends On</SectionTitle>
                  <ChipsContainer>
                    {nodeData.dependsOn.map((dep) => (
                      <NodeChip key={dep} label={dep} onClick={() => onNodeClick?.(dep)} />
                    ))}
                  </ChipsContainer>
                </Section>
              )}

              {nodeData.usedBy.length > 0 && (
                <Section>
                  <SectionTitle>Used By</SectionTitle>
                  <ChipsContainer>
                    {nodeData.usedBy.map((user) => (
                      <NodeChip key={user} label={user} onClick={() => onNodeClick?.(user)} />
                    ))}
                  </ChipsContainer>
                </Section>
              )}

              <Section>
                <SectionTitle>Recent Activity</SectionTitle>
                {nodeData.recentActivity.length > 0 ? (
                  <ActivityContainer>
                    {nodeData.recentActivity.map((activity, index) => (
                      <ActivityLogItem
                        key={index}
                        timestamp={activity.timestamp}
                        event={activity.event}
                        isLast={index === nodeData.recentActivity.length - 1}
                      />
                    ))}
                  </ActivityContainer>
                ) : (
                  <EmptyState>No recent activity</EmptyState>
                )}
              </Section>

              <Section>
                <ActionButton
                  onClick={() => {
                    window.open(
                      `https://github.com/user/repo/blob/main/${nodeData.filePath}`,
                      '_blank'
                    );
                  }}
                >
                  Open in Repo
                </ActionButton>
              </Section>
            </DrawerContent>
          </DrawerContainer>
        </>
      )}
    </AnimatePresence>
  );
};
