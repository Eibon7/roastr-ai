/**
 * Guardian Agent - Governance Reports Dashboard
 * Phase 17: Governance Interface & Alerts
 */

import React, { useState } from 'react';
import { useGuardianCases, useApproveCase, useDenyCase } from '../../hooks/useGuardianCases';
import { GuardianTab, GuardianCaseListParams, GUARDIAN_COLORS } from '../../types/guardian.types';
import CaseCard from './CaseCard';
import DiffModal from './DiffModal';
import CornerSeparator from './CornerSeparator';

export const GovernanceReports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GuardianTab>('ALL');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Build query params based on active tab
  const queryParams: GuardianCaseListParams = {};
  if (activeTab === 'CRITICAL' || activeTab === 'SENSITIVE' || activeTab === 'SAFE') {
    queryParams.severity = activeTab;
  } else if (activeTab === 'APPROVED') {
    queryParams.status = 'APPROVED';
  } else if (activeTab === 'DENIED') {
    queryParams.status = 'DENIED';
  }

  const { data, isLoading, error } = useGuardianCases(queryParams);
  const approveMutation = useApproveCase();
  const denyMutation = useDenyCase();

  const handleViewDiff = (caseId: string) => {
    setSelectedCaseId(caseId);
    setIsModalOpen(true);
  };

  const handleApprove = async (caseId: string, approver: string) => {
    await approveMutation.mutateAsync({ caseId, approver });
  };

  const handleDeny = async (caseId: string, denier: string, reason: string) => {
    await denyMutation.mutateAsync({ caseId, denier, reason });
  };

  const containerStyles: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    padding: '20px',
    fontFamily: "'Courier New', monospace",
    color: '#FFF'
  };

  const headerStyles: React.CSSProperties = {
    marginBottom: '30px',
    borderBottom: `2px solid ${GUARDIAN_COLORS.safe}`,
    paddingBottom: '20px'
  };

  const tabsStyles: React.CSSProperties = {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    flexWrap: 'wrap' as const
  };

  const tabs: GuardianTab[] = ['ALL', 'CRITICAL', 'SENSITIVE', 'SAFE', 'APPROVED', 'DENIED'];

  const selectedCase = data?.cases.find((c) => c.case_id === selectedCaseId) || null;

  return (
    <div style={containerStyles}>
      <div style={headerStyles}>
        <h1 style={{ margin: 0, color: GUARDIAN_COLORS.safe, fontSize: '28px' }}>
          GUARDIAN GOVERNANCE
        </h1>
        <p style={{ margin: '10px 0 0 0', opacity: 0.7 }}>
          Review and approve sensitive changes detected by Guardian Agent
        </p>
      </div>

      <CornerSeparator />

      <div style={tabsStyles}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              backgroundColor: activeTab === tab ? GUARDIAN_COLORS.safe : 'transparent',
              border: `2px solid ${GUARDIAN_COLORS.safe}`,
              color: activeTab === tab ? '#000' : GUARDIAN_COLORS.safe,
              padding: '10px 20px',
              cursor: 'pointer',
              fontFamily: "'Courier New', monospace",
              fontWeight: 'bold',
              fontSize: '12px'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: GUARDIAN_COLORS.safe }}>Loading cases...</p>
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: GUARDIAN_COLORS.critical }}>Error: {error.message}</p>
        </div>
      )}

      {data && data.cases.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: GUARDIAN_COLORS.safe, opacity: 0.7 }}>
            No cases found for filter: {activeTab}
          </p>
        </div>
      )}

      {data && data.cases.length > 0 && (
        <div>
          <p style={{ marginBottom: '20px', opacity: 0.7 }}>
            Showing {data.cases.length} of {data.total} cases
          </p>
          {data.cases.map((caseData) => (
            <CaseCard
              key={caseData.case_id}
              caseData={caseData}
              onApprove={handleApprove}
              onDeny={handleDeny}
              onViewDiff={handleViewDiff}
              isLoading={approveMutation.isPending || denyMutation.isPending}
            />
          ))}
        </div>
      )}

      <DiffModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        caseData={selectedCase}
      />
    </div>
  );
};

export default GovernanceReports;
