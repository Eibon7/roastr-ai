/**
 * GDD System Types
 * @GDD:node=roast,shield,queue-system,multi-tenant
 */

export interface GDDHealthData {
  generated_at: string;
  overall_status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  overall_score: number; // Renamed from average_score for semantic clarity
  node_count: number;
  healthy_count: number;
  degraded_count: number;
  critical_count: number;
  nodes: Record<string, NodeHealth>;
}

export interface NodeHealth {
  score: number;
  status: 'healthy' | 'degraded' | 'critical';
  breakdown: {
    syncAccuracy: number;
    updateFreshness: number;
    dependencyIntegrity: number;
    coverageEvidence: number;
    agentRelevance: number;
  };
  issues: string[];
}

export interface GDDStatusData {
  timestamp: string;
  mode: string;
  nodes_validated: number;
  orphans: string[];
  drift: Record<string, unknown>;
  outdated: string[];
  cycles: string[];
  missing_refs: string[];
  broken_links: string[];
  status: 'healthy' | 'warning' | 'critical';
}

export interface GDDDriftData {
  generated_at: string;
  analysis_period_days: number;
  overall_status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  average_drift_risk: number;
  high_risk_count: number;
  at_risk_count: number;
  healthy_count: number;
  nodes: Record<string, NodeDrift>;
}

export interface NodeDrift {
  drift_risk: number;
  status: 'healthy' | 'at_risk' | 'likely_drift';
  factors: string[];
  recommendations: string[];
  git_activity?: {
    commits_last_30d: number;
    last_commit_days_ago: number;
  };
}
