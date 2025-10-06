import React, { useRef, useEffect, useState } from 'react';
import styled from 'styled-components';
import * as d3 from 'd3';

const GraphContainer = styled.div`
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

const Button = styled.button<{ active?: boolean }>`
  background: ${({ theme, active }) =>
    active ? theme.colors.primary : theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme, active }) => (active ? theme.colors.background : theme.colors.primary)};
  cursor: pointer;
  transition: all 0.15s ease;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &:hover {
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.background};
    box-shadow: ${({ theme }) => theme.shadows.glow};
  }

  @media (max-width: 768px) {
    width: 100%;
  }
`;

const SvgContainer = styled.div`
  width: 100%;
  height: 600px;
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  overflow: hidden;
  position: relative;

  @media (max-width: 768px) {
    height: 400px;
  }
`;

const Legend = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(4)};
  margin-top: ${({ theme }) => theme.spacing(4)};
  flex-wrap: wrap;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const LegendColor = styled.div<{ color: string }>`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: ${({ color }) => color};
  border: 2px solid ${({ color }) => color};
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

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  group: number;
  coverage: number;
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

type LayoutType = 'force' | 'circular' | 'hierarchical';

export function DependencyGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<LayoutType>('force');
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGraphData() {
      try {
        const response = await fetch('/gdd-graph.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch graph data: ${response.statusText}`);
        }
        const graphData: GraphData = await response.json();
        setData(graphData);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }

    fetchGraphData();
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Color scale
    const color = d3.scaleOrdinal<number, string>()
      .domain([1, 2, 3, 4])
      .range(['#00FF41', '#FFB800', '#00D9FF', '#FF3B3B']);

    // Create simulation
    let simulation: d3.Simulation<GraphNode, GraphLink>;

    if (layout === 'force') {
      simulation = d3.forceSimulation<GraphNode>(data.nodes)
        .force('link', d3.forceLink<GraphNode, GraphLink>(data.links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(50));
    } else if (layout === 'circular') {
      const radius = Math.min(width, height) / 3;
      const angleStep = (2 * Math.PI) / data.nodes.length;

      data.nodes.forEach((node, i) => {
        node.x = width / 2 + radius * Math.cos(i * angleStep);
        node.y = height / 2 + radius * Math.sin(i * angleStep);
        node.fx = node.x;
        node.fy = node.y;
      });

      simulation = d3.forceSimulation<GraphNode>(data.nodes)
        .force('link', d3.forceLink<GraphNode, GraphLink>(data.links).id(d => d.id).distance(100));
    } else {
      // Hierarchical layout
      const levels: { [key: number]: GraphNode[] } = {};
      data.nodes.forEach(node => {
        if (!levels[node.group]) levels[node.group] = [];
        levels[node.group].push(node);
      });

      Object.entries(levels).forEach(([group, nodes]) => {
        const y = (parseInt(group) - 1) * (height / 4) + height / 8;
        const spacing = width / (nodes.length + 1);
        nodes.forEach((node, i) => {
          node.x = spacing * (i + 1);
          node.y = y;
          node.fx = node.x;
          node.fy = node.y;
        });
      });

      simulation = d3.forceSimulation<GraphNode>(data.nodes)
        .force('link', d3.forceLink<GraphNode, GraphLink>(data.links).id(d => d.id).distance(100));
    }

    // Draw links
    const link = g.append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke', '#00FF41')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', d => Math.sqrt(d.value) * 2);

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    node.append('circle')
      .attr('r', d => 10 + (d.coverage / 10))
      .attr('fill', d => color(d.group))
      .attr('stroke', '#00FF41')
      .attr('stroke-width', 2)
      .attr('opacity', 0.8)
      .on('mouseenter', function(event, d) {
        setHighlightedNode(d.id);
        d3.select(this)
          .attr('opacity', 1)
          .attr('stroke-width', 4);

        // Highlight connected links
        link.attr('stroke-opacity', l => {
          const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
          const targetId = typeof l.target === 'object' ? l.target.id : l.target;
          return sourceId === d.id || targetId === d.id ? 0.8 : 0.1;
        });
      })
      .on('mouseleave', function() {
        setHighlightedNode(null);
        d3.select(this)
          .attr('opacity', 0.8)
          .attr('stroke-width', 2);

        link.attr('stroke-opacity', 0.3);
      });

    node.append('text')
      .text(d => d.id)
      .attr('x', 0)
      .attr('y', d => -(12 + d.coverage / 10))
      .attr('text-anchor', 'middle')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('fill', '#00FF41')
      .attr('pointer-events', 'none');

    // Coverage badge
    node.append('text')
      .text(d => `${d.coverage}%`)
      .attr('x', 0)
      .attr('y', 4)
      .attr('text-anchor', 'middle')
      .attr('font-family', 'JetBrains Mono, monospace')
      .attr('font-size', '8px')
      .attr('fill', '#0A0E14')
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x!)
        .attr('y1', d => (d.source as GraphNode).y!)
        .attr('x2', d => (d.target as GraphNode).x!)
        .attr('y2', d => (d.target as GraphNode).y!);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>) {
      if (!event.active) simulation.alphaTarget(0);
      if (layout === 'force') {
        event.subject.fx = null;
        event.subject.fy = null;
      }
    }

    return () => {
      simulation.stop();
    };
  }, [data, layout]);

  if (loading) {
    return (
      <GraphContainer>
        <LoadingSpinner>Loading dependency graph...</LoadingSpinner>
      </GraphContainer>
    );
  }

  if (error) {
    return (
      <GraphContainer>
        <ErrorMessage>⚠️ Failed to load graph data: {error}</ErrorMessage>
      </GraphContainer>
    );
  }

  return (
    <GraphContainer>
      <Header>
        <Title>🔗 Dependency Graph</Title>
        <Controls>
          <Button active={layout === 'force'} onClick={() => setLayout('force')}>
            Force
          </Button>
          <Button active={layout === 'circular'} onClick={() => setLayout('circular')}>
            Circular
          </Button>
          <Button active={layout === 'hierarchical'} onClick={() => setLayout('hierarchical')}>
            Hierarchical
          </Button>
        </Controls>
      </Header>

      <SvgContainer>
        <svg ref={svgRef} width="100%" height="100%" />
      </SvgContainer>

      <Legend>
        <LegendItem>
          <LegendColor color="#00FF41" />
          <span>Core Services (roast, shield)</span>
        </LegendItem>
        <LegendItem>
          <LegendColor color="#FFB800" />
          <span>Configuration (persona, tone)</span>
        </LegendItem>
        <LegendItem>
          <LegendColor color="#00D9FF" />
          <span>Infrastructure (queue, billing)</span>
        </LegendItem>
        <LegendItem>
          <LegendColor color="#FF3B3B" />
          <span>Analytics & Integrations</span>
        </LegendItem>
      </Legend>

      {highlightedNode && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(0, 255, 65, 0.1)',
          border: '1px solid #00FF41',
          borderRadius: '4px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '14px',
          color: '#00FF41'
        }}>
          Selected: <strong>{highlightedNode}</strong>
        </div>
      )}
    </GraphContainer>
  );
}
