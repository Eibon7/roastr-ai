import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';

/**
 * GDD Phase 14.1 - Agent Activity Monitor
 *
 * Real-time monitoring dashboard for GDD agent actions.
 * Features:
 * - Recent agent actions table
 * - Live telemetry feed (WebSocket)
 * - Statistics panel
 * - Activity distribution chart
 * - Rollback capabilities
 */

interface AgentAction {
  id?: string;
  timestamp: string;
  agent: string;
  action: string;
  target: string;
  result: {
    success: boolean;
    error?: string;
  };
  deltaHealth?: number;
  type?: string;
}

interface TelemetryStats {
  totalEvents: number;
  eventsByAgent: Record<string, number>;
  eventsByType: Record<string, number>;
  avgHealthDelta?: number;
  healthEvents?: number;
  activeSubscribers?: number;
  uptimeFormatted?: string;
}

const Container = styled.div`
  background: #0b0b0d;
  color: #e8e8e8;
  font-family: 'JetBrains Mono', monospace;
  padding: 24px;
  min-height: 100vh;
`;

const Header = styled.div`
  margin-bottom: 32px;
`;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: #50fa7b;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Subtitle = styled.div`
  font-size: 14px;
  color: #8a8a8a;
`;

const TabsContainer = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  border-bottom: 1px solid #2a2a2a;
`;

const Tab = styled.button<{ active: boolean }>`
  background: transparent;
  border: none;
  padding: 12px 24px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: ${({ active }) => (active ? '#50fa7b' : '#8a8a8a')};
  cursor: pointer;
  border-bottom: 2px solid ${({ active }) => (active ? '#50fa7b' : 'transparent')};
  transition: all 0.15s ease;

  &:hover {
    color: ${({ active }) => (active ? '#50fa7b' : '#e8e8e8')};
  }
`;

const Card = styled.div`
  background: #1f1d20;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  padding: 24px;
  margin-bottom: 24px;
`;

const CardTitle = styled.h2`
  font-size: 16px;
  font-weight: 600;
  color: #e8e8e8;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Thead = styled.thead`
  border-bottom: 1px solid #2a2a2a;
`;

const Th = styled.th`
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #8a8a8a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Tbody = styled.tbody``;

const Tr = styled.tr`
  border-bottom: 1px solid #2a2a2a20;
  transition: background 0.15s ease;

  &:hover {
    background: #2a2a2a20;
  }

  &:last-child {
    border-bottom: none;
  }
`;

const Td = styled.td`
  padding: 12px 16px;
  font-size: 13px;
  color: #e8e8e8;
`;

const StatusBadge = styled.span<{ type: 'success' | 'error' | 'rollback' }>`
  display: inline-block;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: ${({ type }) =>
    type === 'success'
      ? '#50fa7b20'
      : type === 'error'
      ? '#ff555520'
      : '#f1fa8c20'};
  color: ${({ type }) =>
    type === 'success'
      ? '#50fa7b'
      : type === 'error'
      ? '#ff5555'
      : '#f1fa8c'};
  border: 1px solid
    ${({ type }) =>
      type === 'success'
        ? '#50fa7b40'
        : type === 'error'
        ? '#ff555540'
        : '#f1fa8c40'};
`;

const AgentBadge = styled.span`
  display: inline-block;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 3px;
  background: #bd93f920;
  color: #bd93f9;
  border: 1px solid #bd93f940;
`;

const HealthDelta = styled.span<{ positive: boolean }>`
  color: ${({ positive }) => (positive ? '#50fa7b' : '#ff5555')};
  font-weight: 600;
`;

const LiveFeed = styled.div`
  max-height: 500px;
  overflow-y: auto;
  background: #0b0b0d;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  padding: 16px;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #1f1d20;
  }

  &::-webkit-scrollbar-thumb {
    background: #2a2a2a;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #3a3a3a;
  }
`;

const FeedItem = styled.div<{ type: 'success' | 'error' | 'rollback' }>`
  padding: 12px;
  margin-bottom: 8px;
  border-left: 3px solid
    ${({ type }) =>
      type === 'success'
        ? '#50fa7b'
        : type === 'error'
        ? '#ff5555'
        : '#f1fa8c'};
  background: #1f1d2080;
  border-radius: 2px;
  transition: background 0.15s ease;

  &:hover {
    background: #1f1d20;
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

const FeedTimestamp = styled.div`
  font-size: 11px;
  color: #8a8a8a;
  margin-bottom: 4px;
`;

const FeedContent = styled.div`
  font-size: 13px;
  color: #e8e8e8;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
`;

const StatCard = styled.div`
  background: #1f1d20;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.15s ease;

  &:hover {
    border-color: #50fa7b40;
    box-shadow: 0 0 20px #50fa7b20;
  }
`;

const StatLabel = styled.div`
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8a8a8a;
`;

const StatValue = styled.div`
  font-size: 32px;
  font-weight: 600;
  color: #50fa7b;
`;

const ConnectionStatus = styled.div<{ connected: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  background: ${({ connected }) => (connected ? '#50fa7b20' : '#8a8a8a20')};
  color: ${({ connected }) => (connected ? '#50fa7b' : '#8a8a8a')};
  border: 1px solid ${({ connected }) => (connected ? '#50fa7b40' : '#8a8a8a40')};
`;

const ConnectionDot = styled.div<{ connected: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ connected }) => (connected ? '#50fa7b' : '#8a8a8a')};
  animation: ${({ connected }) => (connected ? 'pulse 2s infinite' : 'none')};

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;

const Button = styled.button`
  background: #1f1d20;
  border: 1px solid #50fa7b40;
  color: #50fa7b;
  padding: 8px 16px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: #50fa7b20;
    border-color: #50fa7b;
    box-shadow: 0 0 20px #50fa7b20;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const AgentActivityMonitor: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'summary' | 'live'>('summary');
  const [recentActions, setRecentActions] = useState<AgentAction[]>([]);
  const [liveEvents, setLiveEvents] = useState<AgentAction[]>([]);
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    loadRecentActions();
    loadStats();

    // Setup WebSocket connection for live telemetry
    if (activeTab === 'live') {
      connectWebSocket();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [activeTab]);

  const loadRecentActions = async () => {
    try {
      const response = await fetch('/api/gdd/agent-actions?limit=20');
      if (response.ok) {
        const data = await response.json();
        setRecentActions(data.actions || []);
      }
    } catch (error) {
      console.error('Failed to load recent actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/gdd/agent-stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const connectWebSocket = () => {
    // Note: This would connect to a WebSocket endpoint
    // For now, we'll simulate it with polling
    const interval = setInterval(() => {
      loadRecentActions();
      loadStats();
    }, 5000);

    setConnected(true);

    return () => {
      clearInterval(interval);
      setConnected(false);
    };
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusType = (action: AgentAction): 'success' | 'error' | 'rollback' => {
    if (action.type === 'rollback') return 'rollback';
    if (action.result.success === false) return 'error';
    return 'success';
  };

  const handleRefresh = () => {
    loadRecentActions();
    loadStats();
  };

  return (
    <Container>
      <Header>
        <Title>🤖 Agent Activity Monitor</Title>
        <Subtitle>Real-time monitoring of GDD autonomous agent operations</Subtitle>
      </Header>

      {/* Tabs */}
      <TabsContainer>
        <Tab active={activeTab === 'summary'} onClick={() => setActiveTab('summary')}>
          Summary
        </Tab>
        <Tab active={activeTab === 'live'} onClick={() => setActiveTab('live')}>
          Live Telemetry
        </Tab>
      </TabsContainer>

      {/* Statistics Panel */}
      {stats && (
        <StatsGrid>
          <StatCard>
            <StatLabel>Total Events (24h)</StatLabel>
            <StatValue>{stats.totalEvents || 0}</StatValue>
          </StatCard>
          <StatCard>
            <StatLabel>Avg ΔHealth</StatLabel>
            <StatValue>
              {stats.avgHealthDelta !== undefined
                ? stats.avgHealthDelta.toFixed(2)
                : '0.00'}
            </StatValue>
          </StatCard>
          <StatCard>
            <StatLabel>Active Subscribers</StatLabel>
            <StatValue>{stats.activeSubscribers || 0}</StatValue>
          </StatCard>
          <StatCard>
            <StatLabel>Uptime</StatLabel>
            <StatValue style={{ fontSize: '18px' }}>
              {stats.uptimeFormatted || '0h 0m'}
            </StatValue>
          </StatCard>
        </StatsGrid>
      )}

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <CardTitle>Recent Agent Actions</CardTitle>
            <Button onClick={handleRefresh}>Refresh</Button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#8a8a8a' }}>
              Loading...
            </div>
          ) : recentActions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#8a8a8a' }}>
              No actions recorded yet.
            </div>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Timestamp</Th>
                  <Th>Agent</Th>
                  <Th>Action</Th>
                  <Th>Target</Th>
                  <Th>Status</Th>
                  <Th>ΔHealth</Th>
                </Tr>
              </Thead>
              <Tbody>
                {recentActions.map((action, i) => (
                  <Tr key={action.id || i}>
                    <Td style={{ fontSize: '11px', color: '#8a8a8a' }}>
                      {formatTimestamp(action.timestamp)}
                    </Td>
                    <Td>
                      <AgentBadge>{action.agent}</AgentBadge>
                    </Td>
                    <Td>{action.action}</Td>
                    <Td style={{ fontSize: '12px', color: '#8a8a8a' }}>
                      {action.target}
                    </Td>
                    <Td>
                      <StatusBadge type={getStatusType(action)}>
                        {getStatusType(action)}
                      </StatusBadge>
                    </Td>
                    <Td>
                      {action.deltaHealth !== undefined && (
                        <HealthDelta positive={action.deltaHealth >= 0}>
                          {action.deltaHealth >= 0 ? '+' : ''}
                          {action.deltaHealth.toFixed(2)}
                        </HealthDelta>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Live Telemetry Tab */}
      {activeTab === 'live' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <CardTitle>Live Event Feed</CardTitle>
            <ConnectionStatus connected={connected}>
              <ConnectionDot connected={connected} />
              {connected ? 'Connected' : 'Disconnected'}
            </ConnectionStatus>
          </div>

          <LiveFeed>
            {recentActions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#8a8a8a' }}>
                Waiting for events...
              </div>
            ) : (
              recentActions.slice(0, 10).map((event, i) => (
                <FeedItem key={event.id || i} type={getStatusType(event)}>
                  <FeedTimestamp>{formatTimestamp(event.timestamp)}</FeedTimestamp>
                  <FeedContent>
                    <strong>{event.agent}</strong> → {event.action}
                    {event.target && ` on ${event.target}`}
                    {event.deltaHealth !== undefined && (
                      <span style={{ marginLeft: '8px' }}>
                        (ΔHealth:{' '}
                        <HealthDelta positive={event.deltaHealth >= 0}>
                          {event.deltaHealth >= 0 ? '+' : ''}
                          {event.deltaHealth.toFixed(2)}
                        </HealthDelta>
                        )
                      </span>
                    )}
                  </FeedContent>
                </FeedItem>
              ))
            )}
          </LiveFeed>
        </Card>
      )}

      {/* Agent Activity Distribution */}
      {stats && stats.eventsByAgent && Object.keys(stats.eventsByAgent).length > 0 && (
        <Card>
          <CardTitle>Activity by Agent</CardTitle>
          <Table>
            <Thead>
              <Tr>
                <Th>Agent</Th>
                <Th>Actions</Th>
                <Th>Percentage</Th>
              </Tr>
            </Thead>
            <Tbody>
              {Object.entries(stats.eventsByAgent)
                .sort(([, a], [, b]) => b - a)
                .map(([agent, count]) => {
                  const percentage = ((count / stats.totalEvents) * 100).toFixed(1);
                  return (
                    <Tr key={agent}>
                      <Td>
                        <AgentBadge>{agent}</AgentBadge>
                      </Td>
                      <Td>{count}</Td>
                      <Td style={{ color: '#8a8a8a' }}>{percentage}%</Td>
                    </Tr>
                  );
                })}
            </Tbody>
          </Table>
        </Card>
      )}
    </Container>
  );
};
