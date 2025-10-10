/**
 * Guardian Agent - Case Card Component
 * Phase 17: Governance Interface & Alerts
 */

import React, { useState } from 'react';
import {
  GuardianCase,
  GUARDIAN_COLORS,
  formatTimestamp,
  isPending,
  isApproved,
  isDenied,
  validateApprover,
  validateDenialReason,
  CaseCardProps
} from '../../types/guardian.types';
import SeverityTag from './SeverityTag';
import ActionTag from './ActionTag';

export const CaseCard: React.FC<CaseCardProps> = ({ caseData, onApprove, onDeny, onViewDiff, isLoading }) => {
  const [approver, setApprover] = useState('');
  const [denier, setDenier] = useState('');
  const [reason, setReason] = useState('');
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [errors, setErrors] = useState<{ approve?: string; deny?: string }>({});

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
    // Clear previous errors
    setErrors({ ...errors, approve: undefined });

    // Validate using centralized validator
    const validation = validateApprover(approver);
    if (!validation.valid) {
      setErrors({ ...errors, approve: validation.error });
      return;
    }

    try {
      await onApprove(caseData.case_id, approver);
      setShowApproveForm(false);
      setApprover('');
      setErrors({ ...errors, approve: undefined });
    } catch (error: any) {
      setErrors({ ...errors, approve: error.message || 'Failed to approve case' });
    }
  };

  const handleDeny = async () => {
    // Clear previous errors
    setErrors({ ...errors, deny: undefined });

    // Validate denier name
    const denierValidation = validateApprover(denier); // Same validation rules
    if (!denierValidation.valid) {
      setErrors({ ...errors, deny: denierValidation.error });
      return;
    }

    // Validate denial reason
    const reasonValidation = validateDenialReason(reason);
    if (!reasonValidation.valid) {
      setErrors({ ...errors, deny: reasonValidation.error });
      return;
    }

    try {
      await onDeny(caseData.case_id, denier, reason);
      setShowDenyForm(false);
      setDenier('');
      setReason('');
      setErrors({ ...errors, deny: undefined });
    } catch (error: any) {
      setErrors({ ...errors, deny: error.message || 'Failed to deny case' });
    }
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

        {isPending(caseData) && (
          <>
            <button
              onClick={() => setShowApproveForm(!showApproveForm)}
              disabled={isLoading}
              style={{
                backgroundColor: showApproveForm ? GUARDIAN_COLORS.approved : 'transparent',
                border: `1px solid ${GUARDIAN_COLORS.approved}`,
                color: showApproveForm ? '#000' : GUARDIAN_COLORS.approved,
                padding: '8px 16px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
                fontFamily: "'Courier New', monospace"
              }}
            >
              {showApproveForm ? 'Cancel' : 'Approve'}
            </button>

            <button
              onClick={() => setShowDenyForm(!showDenyForm)}
              disabled={isLoading}
              style={{
                backgroundColor: showDenyForm ? GUARDIAN_COLORS.critical : 'transparent',
                border: `1px solid ${GUARDIAN_COLORS.critical}`,
                color: showDenyForm ? '#FFF' : GUARDIAN_COLORS.critical,
                padding: '8px 16px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
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
          <label
            htmlFor={`approver-input-${caseData.case_id}`}
            style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: GUARDIAN_COLORS.safe }}
          >
            Approver Name:
          </label>
          <input
            id={`approver-input-${caseData.case_id}`}
            type="text"
            placeholder="Your name"
            value={approver}
            onChange={e => setApprover(e.target.value)}
            aria-invalid={!!errors.approve}
            aria-describedby={errors.approve ? `approver-error-${caseData.case_id}` : undefined}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${errors.approve ? GUARDIAN_COLORS.critical : GUARDIAN_COLORS.safe}`,
              color: '#FFF',
              fontFamily: "'Courier New', monospace",
              opacity: isLoading ? 0.5 : 1
            }}
          />
          {errors.approve && (
            <p
              id={`approver-error-${caseData.case_id}`}
              role="alert"
              style={{
                color: GUARDIAN_COLORS.critical,
                fontSize: '11px',
                marginBottom: '10px',
                marginTop: '-5px'
              }}
            >
              {errors.approve}
            </p>
          )}
          <button
            onClick={handleApprove}
            disabled={isLoading}
            style={{
              backgroundColor: GUARDIAN_COLORS.approved,
              border: 'none',
              color: '#000',
              padding: '8px 16px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontFamily: "'Courier New', monospace",
              fontWeight: 'bold',
              opacity: isLoading ? 0.5 : 1
            }}
          >
            {isLoading ? 'Processing...' : 'Confirm Approval'}
          </button>
        </div>
      )}

      {showDenyForm && (
        <div style={{ marginTop: '15px', padding: '15px', border: `1px solid ${GUARDIAN_COLORS.critical}` }}>
          <label
            htmlFor={`denier-input-${caseData.case_id}`}
            style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: GUARDIAN_COLORS.safe }}
          >
            Your Name:
          </label>
          <input
            id={`denier-input-${caseData.case_id}`}
            type="text"
            placeholder="Your name"
            value={denier}
            onChange={e => setDenier(e.target.value)}
            aria-invalid={!!errors.deny}
            aria-describedby={errors.deny ? `deny-error-${caseData.case_id}` : undefined}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${errors.deny ? GUARDIAN_COLORS.critical : GUARDIAN_COLORS.safe}`,
              color: '#FFF',
              fontFamily: "'Courier New', monospace",
              opacity: isLoading ? 0.5 : 1
            }}
          />
          <label
            htmlFor={`reason-input-${caseData.case_id}`}
            style={{ display: 'block', marginBottom: '5px', fontSize: '12px', color: GUARDIAN_COLORS.safe }}
          >
            Denial Reason (min 10 characters):
          </label>
          <textarea
            id={`reason-input-${caseData.case_id}`}
            placeholder="Reason for denial (min 10 characters)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            aria-invalid={!!errors.deny}
            aria-describedby={errors.deny ? `deny-error-${caseData.case_id}` : undefined}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${errors.deny ? GUARDIAN_COLORS.critical : GUARDIAN_COLORS.safe}`,
              color: '#FFF',
              fontFamily: "'Courier New', monospace",
              resize: 'vertical' as const,
              opacity: isLoading ? 0.5 : 1
            }}
          />
          {errors.deny && (
            <p
              id={`deny-error-${caseData.case_id}`}
              role="alert"
              style={{
                color: GUARDIAN_COLORS.critical,
                fontSize: '11px',
                marginBottom: '10px',
                marginTop: '-5px'
              }}
            >
              {errors.deny}
            </p>
          )}
          <button
            onClick={handleDeny}
            disabled={isLoading}
            style={{
              backgroundColor: GUARDIAN_COLORS.critical,
              border: 'none',
              color: '#FFF',
              padding: '8px 16px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontFamily: "'Courier New', monospace",
              fontWeight: 'bold',
              opacity: isLoading ? 0.5 : 1
            }}
          >
            {isLoading ? 'Processing...' : 'Confirm Denial'}
          </button>
        </div>
      )}
    </div>
  );
};

export default CaseCard;
