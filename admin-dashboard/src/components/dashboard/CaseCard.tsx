/**
 * Guardian Agent - Case Card Component
 * Phase 17: Governance Interface & Alerts
 */

import React, { useState } from 'react';
import { GuardianCase, GUARDIAN_COLORS, formatTimestamp, isPending, isApproved, isDenied } from '../../types/guardian.types';
import SeverityTag from './SeverityTag';
import ActionTag from './ActionTag';

interface CaseCardProps {
  caseData: GuardianCase;
  onApprove: (caseId: string, approver: string) => Promise<void>;
  onDeny: (caseId: string, denier: string, reason: string) => Promise<void>;
  onViewDiff: (caseId: string) => void;
  isLoading?: boolean;
}

export const CaseCard: React.FC<CaseCardProps> = ({ caseData, onApprove, onDeny, onViewDiff, isLoading }) => {
  const [approver, setApprover] = useState('');
  const [denier, setDenier] = useState('');
  const [reason, setReason] = useState('');
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [showDenyForm, setShowDenyForm] = useState(false);

  const cardStyles: React.CSSProperties = {
    backgroundColor: '#111',
    border: `2px solid ${GUARDIAN_COLORS.safe}`,
    borderRadius: '0',
    padding: '20px',
    marginBottom: '20px',
    fontFamily: "'Courier New', monospace",
    color: '#FFF'
  };

  const handleApprove = async () => {
    if (!approver.trim()) {
      alert('Approver name is required');
      return;
    }
    await onApprove(caseData.case_id, approver);
    setShowApproveForm(false);
    setApprover('');
  };

  const handleDeny = async () => {
    if (!denier.trim() || !reason.trim()) {
      alert('Denier name and reason are required');
      return;
    }
    await onDeny(caseData.case_id, denier, reason);
    setShowDenyForm(false);
    setDenier('');
    setReason('');
  };

  return (
    <div style={cardStyles}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <div>
          <h3 style={{ margin: '0 0 10px 0', color: GUARDIAN_COLORS.safe }}>
            {caseData.case_id}
          </h3>
          <p style={{ margin: '5px 0', fontSize: '12px', opacity: 0.8 }}>
            {formatTimestamp(caseData.timestamp)} by {caseData.actor}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <SeverityTag severity={caseData.severity} />
          <ActionTag action={caseData.action} />
        </div>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <p style={{ margin: '5px 0', fontSize: '13px' }}>
          <strong>Domains:</strong> {caseData.domains.join(', ')}
        </p>
        <p style={{ margin: '5px 0', fontSize: '13px' }}>
          <strong>Files:</strong> {caseData.files_changed.length} changed
        </p>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          onClick={() => onViewDiff(caseData.case_id)}
          style={{
            backgroundColor: 'transparent',
            border: `1px solid ${GUARDIAN_COLORS.safe}`,
            color: GUARDIAN_COLORS.safe,
            padding: '8px 16px',
            cursor: 'pointer',
            fontFamily: "'Courier New', monospace"
          }}
        >
          View Diff
        </button>

        {isPending(caseData) && !isLoading && (
          <>
            <button
              onClick={() => setShowApproveForm(!showApproveForm)}
              style={{
                backgroundColor: showApproveForm ? GUARDIAN_COLORS.approved : 'transparent',
                border: `1px solid ${GUARDIAN_COLORS.approved}`,
                color: showApproveForm ? '#000' : GUARDIAN_COLORS.approved,
                padding: '8px 16px',
                cursor: 'pointer',
                fontFamily: "'Courier New', monospace"
              }}
            >
              {showApproveForm ? 'Cancel' : 'Approve'}
            </button>

            <button
              onClick={() => setShowDenyForm(!showDenyForm)}
              style={{
                backgroundColor: showDenyForm ? GUARDIAN_COLORS.critical : 'transparent',
                border: `1px solid ${GUARDIAN_COLORS.critical}`,
                color: showDenyForm ? '#FFF' : GUARDIAN_COLORS.critical,
                padding: '8px 16px',
                cursor: 'pointer',
                fontFamily: "'Courier New', monospace"
              }}
            >
              {showDenyForm ? 'Cancel' : 'Deny'}
            </button>
          </>
        )}

        {isApproved(caseData) && (
          <p style={{ margin: 0, color: GUARDIAN_COLORS.approved }}>
            Approved by {caseData.approved_by}
          </p>
        )}

        {isDenied(caseData) && (
          <p style={{ margin: 0, color: GUARDIAN_COLORS.critical }}>
            Denied by {caseData.denied_by}
          </p>
        )}
      </div>

      {showApproveForm && (
        <div style={{ marginTop: '15px', padding: '15px', border: `1px solid ${GUARDIAN_COLORS.approved}` }}>
          <input
            type="text"
            placeholder="Your name"
            value={approver}
            onChange={e => setApprover(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${GUARDIAN_COLORS.safe}`,
              color: '#FFF',
              fontFamily: "'Courier New', monospace"
            }}
          />
          <button onClick={handleApprove} style={{
            backgroundColor: GUARDIAN_COLORS.approved,
            border: 'none',
            color: '#000',
            padding: '8px 16px',
            cursor: 'pointer',
            fontFamily: "'Courier New', monospace",
            fontWeight: 'bold'
          }}>
            Confirm Approval
          </button>
        </div>
      )}

      {showDenyForm && (
        <div style={{ marginTop: '15px', padding: '15px', border: `1px solid ${GUARDIAN_COLORS.critical}` }}>
          <input
            type="text"
            placeholder="Your name"
            value={denier}
            onChange={e => setDenier(e.target.value)}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${GUARDIAN_COLORS.safe}`,
              color: '#FFF',
              fontFamily: "'Courier New', monospace"
            }}
          />
          <textarea
            placeholder="Reason for denial (min 10 characters)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${GUARDIAN_COLORS.safe}`,
              color: '#FFF',
              fontFamily: "'Courier New', monospace",
              resize: 'vertical' as const
            }}
          />
          <button onClick={handleDeny} style={{
            backgroundColor: GUARDIAN_COLORS.critical,
            border: 'none',
            color: '#FFF',
            padding: '8px 16px',
            cursor: 'pointer',
            fontFamily: "'Courier New', monospace",
            fontWeight: 'bold'
          }}>
            Confirm Denial
          </button>
        </div>
      )}
    </div>
  );
};

export default CaseCard;
