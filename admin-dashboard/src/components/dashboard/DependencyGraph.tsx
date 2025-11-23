import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import * as d3 from 'd3';

// ===== CONSTANTS =====
const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const NODE_BORDER_RADIUS = 8;
const HORIZONTAL_GAP = 180;
const VERTICAL_GAP = 40;
const CANVAS_PADDING = 80;
const CANVAS_HEIGHT = 600;
const BEZIER_CONTROL_OFFSET_CAP = 100;

// ===== SVG ICON COMPONENTS =====
const MessageSquareIcon = ({ color = '#8AFF80' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const ShieldIcon = ({ color = '#8AFF80' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const UserIcon = ({ color = '#8AFF80' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MusicIcon = ({ color = '#8AFF80' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const SettingsIcon = ({ color = '#8AFF80' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v6m0 6v6M1 12h6m6 0h6M4.2 4.2l4.3 4.3m5.5 5.5l4.3 4.3m-4.3-14.1l4.3-4.3M9.5 14.5l-4.3 4.3" />
  </svg>
);

const LayersIcon = ({ color = '#8AFF80' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const BuildingIcon = ({ color = '#8AFF80' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
  </svg>
);

const DollarSignIcon = ({ color = '#8AFF80' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const CreditCardIcon = ({ color = '#8AFF80' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const PackageIcon = ({ color = '#8AFF80' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const Share2Icon = ({ color = '#8AFF80' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const BarChart2Icon = ({ color = '#8AFF80' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

const BrainIcon = ({ color = '#8AFF80' }: { color?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
  </svg>
);

// ===== ICON MAPPING =====
const nodeIcons: Record<string, React.ReactNode> = {
  roast: <MessageSquareIcon />,
  shield: <ShieldIcon />,
  persona: <UserIcon />,
  tone: <MusicIcon />,
  'platform-constraints': <SettingsIcon />,
  'queue-system': <LayersIcon />,
  'multi-tenant': <BuildingIcon />,
  'cost-control': <DollarSignIcon />,
  billing: <CreditCardIcon />,
  'plan-features': <PackageIcon />,
  'social-platforms': <Share2Icon />,
  analytics: <BarChart2Icon />,
  trainer: <BrainIcon />
};

// ===== LAYER ASSIGNMENTS =====
const LAYER_ASSIGNMENTS: Record<string, number> = {
  // Layer 0 (leftmost - inputs)
  persona: 0,
  tone: 0,
  'platform-constraints': 0,
  'multi-tenant': 0,

  // Layer 1 (processing)
  'cost-control': 1,
  'plan-features': 1,
  'queue-system': 1,

  // Layer 2 (core business logic)
  billing: 2,
  roast: 2,
  shield: 2,
  'social-platforms': 2,

  // Layer 3 (rightmost - outputs)
  analytics: 3,
  trainer: 3
};

// ===== TYPES =====
interface GraphNode {
  id: string;
  group: number;
  coverage?: number;
  x?: number;
  y?: number;
  layer?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ===== STYLED COMPONENTS =====
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

const Button = styled.button<{ $active?: boolean }>`
  background: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.background)};
  border: 1px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  padding: ${({ theme }) => `${theme.spacing(2)} ${theme.spacing(4)}`};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme, $active }) => ($active ? theme.colors.background : theme.colors.primary)};
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
  height: ${CANVAS_HEIGHT}px;
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  overflow: auto;
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
  border-radius: 4px;
  background: ${({ color }) => color};
`;

/**
 * Compute absolute canvas positions and assign a layer index for each node.
 *
 * Positions are derived from a predefined mapping of node IDs to horizontal layers and from layout constants (node size, gaps, and canvas padding); nodes within the same layer are vertically stacked and centered.
 *
 * @param nodes - Array of nodes whose `id` values are used to determine horizontal layer placement
 * @returns A new array of GraphNode where each node includes computed `x`, `y`, and `layer` properties
 */
function calculateNodePositions(nodes: GraphNode[]): GraphNode[] {
  // Group nodes by layer
  const layers: Record<number, GraphNode[]> = {};

  nodes.forEach((node) => {
    const layer = LAYER_ASSIGNMENTS[node.id] ?? 0;
    if (!layers[layer]) layers[layer] = [];
    layers[layer].push({ ...node, layer });
  });

  const positionedNodes: GraphNode[] = [];

  // Calculate positions for each layer
  Object.entries(layers).forEach(([layerStr, layerNodes]) => {
    const layer = parseInt(layerStr);
    const layerHeight = layerNodes.length * (NODE_HEIGHT + VERTICAL_GAP) - VERTICAL_GAP;
    const startY = CANVAS_PADDING + (CANVAS_HEIGHT - 2 * CANVAS_PADDING - layerHeight) / 2;

    layerNodes.forEach((node, index) => {
      positionedNodes.push({
        ...node,
        x: layer * (NODE_WIDTH + HORIZONTAL_GAP) + CANVAS_PADDING,
        y: startY + index * (NODE_HEIGHT + VERTICAL_GAP),
        layer
      });
    });
  });

  return positionedNodes;
}

/**
 * Create a cubic Bezier SVG path that connects two node rectangles horizontally.
 *
 * Generates a path starting at the right center of the source node and ending at the left center of the target node, using control points biased toward the horizontal midpoint (capped) to produce a smooth curve.
 *
 * @param sourceX - X coordinate of the source node's top-left corner
 * @param sourceY - Y coordinate of the source node's top-left corner
 * @param targetX - X coordinate of the target node's top-left corner
 * @param targetY - Y coordinate of the target node's top-left corner
 * @returns An SVG path string for a cubic Bezier curve connecting the two nodes
 */
function generateBezierPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): string {
  const dx = targetX - sourceX;
  const controlX1 = sourceX + Math.min(dx * 0.5, BEZIER_CONTROL_OFFSET_CAP);
  const controlX2 = targetX - Math.min(dx * 0.5, BEZIER_CONTROL_OFFSET_CAP);

  return `M ${sourceX + NODE_WIDTH} ${sourceY + NODE_HEIGHT / 2}
          C ${controlX1} ${sourceY + NODE_HEIGHT / 2},
            ${controlX2} ${targetY + NODE_HEIGHT / 2},
            ${targetX} ${targetY + NODE_HEIGHT / 2}`;
}

/**
 * Render an interactive dependency graph visualization for workflow nodes and links.
 *
 * Fetches graph data (from /gdd-graph.json), lays out nodes, and renders an SVG-based graph with hover and selection interactions, animated transitions (disabled when the user prefers reduced motion), and a legend and controls bar.
 *
 * @returns The rendered React element containing the dependency graph UI
 */
export function DependencyGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Fetch graph data
    fetch('/gdd-graph.json')
      .then((response) => response.json())
      .then((data: GraphData) => {
        // Calculate node positions
        const positionedNodes = calculateNodePositions(data.nodes);

        // Calculate SVG dimensions based on layout
        const maxLayer = Math.max(...positionedNodes.map((n) => n.layer ?? 0));
        const svgWidth = (maxLayer + 1) * (NODE_WIDTH + HORIZONTAL_GAP) + 2 * CANVAS_PADDING;
        const svgHeight = CANVAS_HEIGHT;

        svg.attr('width', svgWidth).attr('height', svgHeight);

        // Define arrow marker
        const defs = svg.append('defs');
        defs
          .append('marker')
          .attr('id', 'arrowhead')
          .attr('markerWidth', 10)
          .attr('markerHeight', 10)
          .attr('refX', 9)
          .attr('refY', 3)
          .attr('orient', 'auto')
          .attr('markerUnits', 'strokeWidth')
          .append('path')
          .attr('d', 'M0,0 L0,6 L9,3 z')
          .attr('fill', 'rgba(255, 255, 255, 0.3)');

        // Create node lookup
        const nodeMap = new Map(positionedNodes.map((n) => [n.id, n]));

        // Draw links
        const linkGroup = svg.append('g').attr('class', 'links');
        data.links.forEach((link) => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          const sourceNode = nodeMap.get(sourceId);
          const targetNode = nodeMap.get(targetId);

          if (
            sourceNode &&
            targetNode &&
            sourceNode.x !== undefined &&
            sourceNode.y !== undefined &&
            targetNode.x !== undefined &&
            targetNode.y !== undefined
          ) {
            const path = generateBezierPath(sourceNode.x, sourceNode.y, targetNode.x, targetNode.y);

            linkGroup
              .append('path')
              .attr('d', path)
              .attr('stroke', 'rgba(255, 255, 255, 0.2)')
              .attr('stroke-width', 2)
              .attr('fill', 'none')
              .attr('marker-end', 'url(#arrowhead)')
              .attr('data-source', sourceId)
              .attr('data-target', targetId)
              .style('transition', 'stroke 0.3s ease, stroke-width 0.3s ease');
          }
        });

        // Draw nodes
        const nodeGroup = svg.append('g').attr('class', 'nodes');
        positionedNodes.forEach((node) => {
          if (node.x === undefined || node.y === undefined) return;

          const g = nodeGroup
            .append('g')
            .attr('class', 'node')
            .attr('data-node-id', node.id)
            .attr('transform', `translate(${node.x}, ${node.y})`)
            .style('cursor', 'pointer');

          // Node background
          const rect = g
            .append('rect')
            .attr('width', NODE_WIDTH)
            .attr('height', NODE_HEIGHT)
            .attr('rx', NODE_BORDER_RADIUS)
            .attr('fill', 'rgba(26, 32, 38, 0.95)')
            .attr('stroke', 'rgba(138, 255, 128, 0.3)')
            .attr('stroke-width', 1.5)
            .style('transition', 'all 0.3s ease');

          // Node content group
          const contentG = g
            .append('g')
            .attr('transform', `translate(${NODE_WIDTH / 2}, ${NODE_HEIGHT / 2})`);

          // Icon (centered at top of content area)
          const iconG = contentG
            .append('g')
            .attr('transform', 'translate(-12, -25)')
            .attr('color', '#8AFF80');

          // Text label (below icon)
          contentG
            .append('text')
            .attr('y', 8)
            .attr('text-anchor', 'middle')
            .attr('font-family', 'JetBrains Mono, monospace')
            .attr('font-size', '12px')
            .attr('font-weight', '600')
            .attr('fill', '#ffffff')
            .text(node.id);

          // Coverage badge
          if (node.coverage !== undefined) {
            contentG
              .append('text')
              .attr('y', 24)
              .attr('text-anchor', 'middle')
              .attr('font-family', 'JetBrains Mono, monospace')
              .attr('font-size', '10px')
              .attr('fill', '#8AFF80')
              .text(`${node.coverage}%`);
          }

          // Event handlers
          g.on('mouseenter', function () {
            setHoveredNode(node.id);

            if (!prefersReducedMotion) {
              d3.select(this)
                .select('rect')
                .transition()
                .duration(200)
                .attr('fill', 'rgba(26, 32, 38, 1)')
                .attr('stroke', 'rgba(138, 255, 128, 0.6)')
                .attr('stroke-width', 2)
                .attr('transform', 'scale(1.02)');
            } else {
              d3.select(this)
                .select('rect')
                .attr('stroke', 'rgba(138, 255, 128, 0.6)')
                .attr('stroke-width', 2);
            }

            // Highlight connected paths
            svg
              .selectAll('path')
              .filter(function () {
                const path = d3.select(this);
                return path.attr('data-source') === node.id || path.attr('data-target') === node.id;
              })
              .attr('stroke', 'rgba(138, 255, 128, 0.6)')
              .attr('stroke-width', 3);
          })
            .on('mouseleave', function () {
              setHoveredNode(null);

              if (!prefersReducedMotion) {
                d3.select(this)
                  .select('rect')
                  .transition()
                  .duration(200)
                  .attr('fill', 'rgba(26, 32, 38, 0.95)')
                  .attr('stroke', 'rgba(138, 255, 128, 0.3)')
                  .attr('stroke-width', 1.5)
                  .attr('transform', 'scale(1)');
              } else {
                d3.select(this)
                  .select('rect')
                  .attr('stroke', 'rgba(138, 255, 128, 0.3)')
                  .attr('stroke-width', 1.5);
              }

              // Reset path highlighting
              svg
                .selectAll('path')
                .attr('stroke', 'rgba(255, 255, 255, 0.2)')
                .attr('stroke-width', 2);
            })
            .on('click', function () {
              setSelectedNode(selectedNode === node.id ? null : node.id);

              if (!prefersReducedMotion) {
                d3.select(this)
                  .select('rect')
                  .transition()
                  .duration(100)
                  .attr('transform', 'scale(0.98)')
                  .transition()
                  .duration(200)
                  .attr('transform', 'scale(1.05)')
                  .transition()
                  .duration(100)
                  .attr('transform', 'scale(1)');
              }
            });
        });
      })
      .catch((error) => {
        console.error('Failed to load graph data:', error);
      });
  }, [selectedNode, prefersReducedMotion]);

  return (
    <GraphContainer>
      <Header>
        <Title>🔗 Dependency Graph</Title>
        <Controls>
          <Button $active={true}>Workflow View</Button>
        </Controls>
      </Header>

      <SvgContainer>
        <svg ref={svgRef} style={{ display: 'block' }} />
      </SvgContainer>

      <Legend>
        <LegendItem>
          <LegendColor color="rgba(138, 255, 128, 0.3)" />
          <span>Node Border</span>
        </LegendItem>
        <LegendItem>
          <LegendColor color="rgba(138, 255, 128, 0.6)" />
          <span>Hover State</span>
        </LegendItem>
        <LegendItem>
          <LegendColor color="rgba(255, 255, 255, 0.2)" />
          <span>Dependency Path</span>
        </LegendItem>
      </Legend>
    </GraphContainer>
  );
}
