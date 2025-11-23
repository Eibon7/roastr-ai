/**
 * Guardian Agent - Diff Modal Component
 * Phase 17: Governance Interface & Alerts
 */

import React, { useEffect } from 'react';
import { GuardianCase, GUARDIAN_COLORS, DiffModalProps } from '../../types/guardian.types';

export const DiffModal: React.FC<DiffModalProps> = ({ isOpen, onClose, caseData }) => {
  // ESC key handler for accessibility (WCAG 2.1)
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !caseData) return null;

  const overlayStyles: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  };

  const modalStyles: React.CSSProperties = {
    backgroundColor: '#0a0a0a',
    border: `2px solid ${GUARDIAN_COLORS.safe}`,
    borderRadius: '0',
    maxWidth: '1200px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    fontFamily: "'Courier New', monospace",
    color: '#FFF'
  };

  const headerStyles: React.CSSProperties = {
    padding: '20px',
    borderBottom: `2px solid ${GUARDIAN_COLORS.safe}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const bodyStyles: React.CSSProperties = {
    padding: '20px',
    fontSize: '12px',
    lineHeight: '1.6'
  };

  return (
    <div style={overlayStyles} onClick={onClose}>
      <div
        style={modalStyles}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="diff-modal-title"
      >
        <div style={headerStyles}>
          <h2 id="diff-modal-title" style={{ margin: 0, color: GUARDIAN_COLORS.safe }}>
            Git Diff - {caseData.case_id}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: `1px solid ${GUARDIAN_COLORS.safe}`,
              color: GUARDIAN_COLORS.safe,
              padding: '8px 16px',
              cursor: 'pointer',
              fontFamily: "'Courier New', monospace"
            }}
          >
            Close [ESC]
          </button>
        </div>
        <div style={bodyStyles}>
          <h3 style={{ color: GUARDIAN_COLORS.safe }}>Files Changed:</h3>
          <ul>
            {caseData.files_changed.map((file, idx) => (
              <li key={idx} style={{ marginBottom: '5px' }}>
                {file}
              </li>
            ))}
          </ul>
          <p style={{ marginTop: '20px', opacity: 0.7 }}>
            Full diff viewer will be implemented with syntax highlighting. For now, use: git diff{' '}
            {caseData.case_id}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DiffModal;
