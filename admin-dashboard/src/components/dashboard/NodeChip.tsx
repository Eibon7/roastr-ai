import React from 'react';
import styled from 'styled-components';

interface NodeChipProps {
  label: string;
  onClick?: () => void;
  active?: boolean;
}

const ChipContainer = styled.button<{ $active?: boolean }>`
  height: 28px;
  padding: 4px 12px;
  border-radius: 4px;
  background: ${({ $active }) => ($active ? 'rgba(80, 250, 123, 0.1)' : '#1f1d20')};
  border: 1px solid ${({ $active }) => ($active ? '#50fa7b' : 'rgba(255, 255, 255, 0.12)')};
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  color: #bdbdbd;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &:hover {
    border-color: #50fa7b;
    background: rgba(80, 250, 123, 0.05);
  }

  &:active {
    background: rgba(80, 250, 123, 0.15);
  }

  &:focus-visible {
    outline: 2px solid #50fa7b;
    outline-offset: 2px;
  }
`;

export const NodeChip: React.FC<NodeChipProps> = ({ label, onClick, active }) => {
  return (
    <ChipContainer onClick={onClick} $active={active} aria-label={`Navigate to ${label} node`}>
      {label}
    </ChipContainer>
  );
};
