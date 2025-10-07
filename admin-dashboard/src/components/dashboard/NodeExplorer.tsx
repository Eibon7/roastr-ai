import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { useGDDHealth } from '@hooks/useGDDHealth';
import { formatDistanceToNow } from 'date-fns';

const ExplorerContainer = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing(6)};
  box-shadow: ${({ theme }) => theme.shadows.md};
  animation: ${({ theme }) => theme.animations.slideIn};
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing(6)};
  padding-bottom: ${({ theme }) => theme.spacing(4)};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};

  @media (max-width: 768px) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing(4)};
    align-items: stretch;
  }
`;

const Title = styled.h2`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.h2};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.textPrimary};
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const Controls = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  align-items: center;

  @media (max-width: 768px) {
    flex-direction: column;
    width: 100%;
  }
`;

const SearchInput = styled.input`
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  min-width: 250px;
  transition: all 0.15s ease;

  &::placeholder {
    color: ${({ theme }) => theme.colors.textDisabled};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primary}20;
  }

  @media (max-width: 768px) {
    width: 100%;
    min-width: unset;
  }
`;

const FilterSelect = styled.select`
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(3)}`};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textPrimary};
  cursor: pointer;
  transition: all 0.15s ease;

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primary}20;
  }

  option {
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.textPrimary};
  }

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const TableContainer = styled.div`
  overflow-x: auto;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  @media (max-width: 768px) {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
  }
`;

const Thead = styled.thead`
  background: ${({ theme }) => theme.colors.background};
  border-bottom: 2px solid ${({ theme }) => theme.colors.primary};
`;

const Th = styled.th<{ sortable?: boolean }>`
  padding: ${({ theme }) => `${theme.spacing(3)} ${theme.spacing(4)}`};
  text-align: left;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.primary};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: ${({ sortable }) => (sortable ? 'pointer' : 'default')};
  user-select: none;
  transition: all 0.15s ease;

  &:hover {
    background: ${({ theme, sortable }) =>
      sortable ? theme.colors.surfaceHover : 'transparent'};
  }

  @media (max-width: 768px) {
    padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(2)}`};
  }
`;

const Tbody = styled.tbody`
  tr:nth-child(even) {
    background: ${({ theme }) => theme.colors.background}40;
  }
`;

const Tr = styled.tr<{ expanded?: boolean }>`
  transition: all 0.15s ease;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
    border-left: 3px solid ${({ theme }) => theme.colors.primary};
  }

  ${({ expanded, theme }) =>
    expanded &&
    `
    background: ${theme.colors.surfaceHover};
    border-left: 3px solid ${theme.colors.primary};
  `}
`;

const Td = styled.td`
  padding: ${({ theme }) => `${theme.spacing(3)} ${theme.spacing(4)}`};
  color: ${({ theme }) => theme.colors.textPrimary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};

  @media (max-width: 768px) {
    padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(2)}`};
  }
`;

const StatusBadge = styled.span<{ status: 'healthy' | 'degraded' | 'critical' }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => `${theme.spacing(1)} ${theme.spacing(3)}`};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  text-transform: uppercase;
  letter-spacing: 0.05em;

  ${({ status, theme }) => {
    switch (status) {
      case 'healthy':
        return `
          background: ${theme.colors.statusHealthy}20;
          color: ${theme.colors.statusHealthy};
          border: 1px solid ${theme.colors.statusHealthy};
        `;
      case 'degraded':
        return `
          background: ${theme.colors.statusWarning}20;
          color: ${theme.colors.statusWarning};
          border: 1px solid ${theme.colors.statusWarning};
        `;
      case 'critical':
        return `
          background: ${theme.colors.statusCritical}20;
          color: ${theme.colors.statusCritical};
          border: 1px solid ${theme.colors.statusCritical};
        `;
      default:
        return '';
    }
  }}

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
  }
`;

const ScoreCell = styled.div<{ score: number }>`
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ score, theme }) => {
    if (score >= 80) return theme.colors.statusHealthy;
    if (score >= 50) return theme.colors.statusWarning;
    return theme.colors.statusCritical;
  }};
`;

const ExpandedRow = styled.tr`
  background: ${({ theme }) => theme.colors.background};
  border-left: 3px solid ${({ theme }) => theme.colors.primary};
`;

const ExpandedCell = styled.td`
  padding: ${({ theme }) => theme.spacing(6)}!important;
  border-bottom: 2px solid ${({ theme }) => theme.colors.primary}!important;
`;

const DetailsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: ${({ theme }) => theme.spacing(4)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

const DetailCard = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => theme.spacing(3)};
`;

const DetailLabel = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const DetailValue = styled.div`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.primary};
`;

const IssuesList = styled.ul`
  list-style: none;
  padding: 0;
  margin: ${({ theme }) => `${theme.spacing(4)} 0 0 0`};
`;

const IssueItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  background: ${({ theme }) => theme.colors.statusCritical}10;
  border-left: 3px solid ${({ theme }) => theme.colors.statusCritical};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textPrimary};

  &::before {
    content: '⚠';
    color: ${({ theme }) => theme.colors.statusCritical};
    font-size: ${({ theme }) => theme.typography.fontSize.md};
    flex-shrink: 0;
  }
`;

const LoadingSpinner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing(8)};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
`;

const ErrorMessage = styled.div`
  padding: ${({ theme }) => theme.spacing(4)};
  background: ${({ theme }) => theme.colors.statusCritical}15;
  border: 1px solid ${({ theme }) => theme.colors.statusCritical};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  color: ${({ theme }) => theme.colors.statusCritical};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
`;

const EmptyState = styled.div`
  padding: ${({ theme }) => theme.spacing(8)};
  text-align: center;
  color: ${({ theme }) => theme.colors.textDisabled};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
`;

type SortColumn = 'name' | 'score' | 'status' | 'coverage';
type SortDirection = 'asc' | 'desc';

interface NodeRow {
  name: string;
  score: number;
  status: 'healthy' | 'degraded' | 'critical';
  coverage: number;
  syncAccuracy: number;
  updateFreshness: number;
  dependencyIntegrity: number;
  agentRelevance: number;
  issues: string[];
}

export function NodeExplorer() {
  const { data: healthData, isLoading, error } = useGDDHealth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [coverageFilter, setCoverageFilter] = useState<string>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  const nodes: NodeRow[] = useMemo(() => {
    if (!healthData) return [];

    return Object.entries(healthData.nodes).map(([name, node]) => ({
      name,
      score: node.score,
      status: node.status,
      coverage: node.breakdown.coverageEvidence,
      syncAccuracy: node.breakdown.syncAccuracy,
      updateFreshness: node.breakdown.updateFreshness,
      dependencyIntegrity: node.breakdown.dependencyIntegrity,
      agentRelevance: node.breakdown.agentRelevance,
      issues: node.issues || [],
    }));
  }, [healthData]);

  const filteredNodes = useMemo(() => {
    let result = nodes;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((node) => node.name.toLowerCase().includes(query));
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((node) => node.status === statusFilter);
    }

    // Coverage filter
    if (coverageFilter !== 'all') {
      result = result.filter((node) => {
        if (coverageFilter === 'high') return node.coverage >= 80;
        if (coverageFilter === 'medium') return node.coverage >= 60 && node.coverage < 80;
        if (coverageFilter === 'low') return node.coverage < 60;
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number = a[sortColumn];
      let bVal: string | number = b[sortColumn];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return result;
  }, [nodes, searchQuery, statusFilter, coverageFilter, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const toggleExpand = (nodeName: string) => {
    setExpandedNode(expandedNode === nodeName ? null : nodeName);
  };

  if (isLoading) {
    return (
      <ExplorerContainer>
        <LoadingSpinner>Loading node data...</LoadingSpinner>
      </ExplorerContainer>
    );
  }

  if (error) {
    return (
      <ExplorerContainer>
        <ErrorMessage>
          ⚠️ Failed to load node data. Make sure the backend is running and JSON files are generated.
        </ErrorMessage>
      </ExplorerContainer>
    );
  }

  return (
    <ExplorerContainer>
      <Header>
        <Title>📊 Node Explorer</Title>
        <Controls>
          <SearchInput
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <FilterSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="healthy">Healthy</option>
            <option value="degraded">Degraded</option>
            <option value="critical">Critical</option>
          </FilterSelect>
          <FilterSelect value={coverageFilter} onChange={(e) => setCoverageFilter(e.target.value)}>
            <option value="all">All Coverage</option>
            <option value="high">High (≥80%)</option>
            <option value="medium">Medium (60-79%)</option>
            <option value="low">Low (&lt;60%)</option>
          </FilterSelect>
        </Controls>
      </Header>

      <TableContainer>
        <Table>
          <Thead>
            <tr>
              <Th sortable onClick={() => handleSort('name')}>
                Node Name {sortColumn === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
              </Th>
              <Th sortable onClick={() => handleSort('score')}>
                Health Score {sortColumn === 'score' && (sortDirection === 'asc' ? '▲' : '▼')}
              </Th>
              <Th sortable onClick={() => handleSort('status')}>
                Status {sortColumn === 'status' && (sortDirection === 'asc' ? '▲' : '▼')}
              </Th>
              <Th sortable onClick={() => handleSort('coverage')}>
                Coverage {sortColumn === 'coverage' && (sortDirection === 'asc' ? '▲' : '▼')}
              </Th>
            </tr>
          </Thead>
          <Tbody>
            {filteredNodes.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState>No nodes match your filters</EmptyState>
                </td>
              </tr>
            ) : (
              filteredNodes.map((node) => (
                <React.Fragment key={node.name}>
                  <Tr
                    expanded={expandedNode === node.name}
                    onClick={() => toggleExpand(node.name)}
                  >
                    <Td>
                      <strong>{node.name}</strong>
                    </Td>
                    <Td>
                      <ScoreCell score={node.score}>{node.score}/100</ScoreCell>
                    </Td>
                    <Td>
                      <StatusBadge status={node.status}>{node.status}</StatusBadge>
                    </Td>
                    <Td>{node.coverage}%</Td>
                  </Tr>
                  {expandedNode === node.name && (
                    <ExpandedRow>
                      <ExpandedCell colSpan={4}>
                        <DetailsGrid>
                          <DetailCard>
                            <DetailLabel>Sync Accuracy</DetailLabel>
                            <DetailValue>{node.syncAccuracy}/100</DetailValue>
                          </DetailCard>
                          <DetailCard>
                            <DetailLabel>Update Freshness</DetailLabel>
                            <DetailValue>{node.updateFreshness}/100</DetailValue>
                          </DetailCard>
                          <DetailCard>
                            <DetailLabel>Dependency Integrity</DetailLabel>
                            <DetailValue>{node.dependencyIntegrity}/100</DetailValue>
                          </DetailCard>
                          <DetailCard>
                            <DetailLabel>Agent Relevance</DetailLabel>
                            <DetailValue>{node.agentRelevance}/100</DetailValue>
                          </DetailCard>
                        </DetailsGrid>
                        {node.issues.length > 0 && (
                          <>
                            <DetailLabel>Issues ({node.issues.length})</DetailLabel>
                            <IssuesList>
                              {node.issues.map((issue, idx) => (
                                <IssueItem key={idx}>{issue}</IssueItem>
                              ))}
                            </IssuesList>
                          </>
                        )}
                      </ExpandedCell>
                    </ExpandedRow>
                  )}
                </React.Fragment>
              ))
            )}
          </Tbody>
        </Table>
      </TableContainer>
    </ExplorerContainer>
  );
}
