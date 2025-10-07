import React from 'react';
import styled from 'styled-components';

interface StatusCardProps {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  status: 'healthy' | 'warning' | 'critical';
}

const statusColors = {
  healthy: '#50fa7b',
  warning: '#f1fa8c',
  critical: '#ff5555'
};

const CardContainer = styled.div<{ status: 'healthy' | 'warning' | 'critical' }>`
  position: relative;
  min-width: 200px;
  height: 80px;
  background: #1f1d20;
  border: 1px solid ${({ status }) => statusColors[status]}30;
  border-radius: 4px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.15s ease;

  &:hover {
    border-color: ${({ status }) => statusColors[status]}60;
    box-shadow: 0 0 20px ${({ status }) => statusColors[status]}20;
  }
`;

const Label = styled.div`
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8a8a8a;
`;

const ValueContainer = styled.div`
  display: flex;
  align-items: baseline;
  gap: 4px;
`;

const Value = styled.div<{ status: 'healthy' | 'warning' | 'critical' }>`
  font-family: 'JetBrains Mono', monospace;
  font-size: 32px;
  font-weight: 600;
  color: ${({ status }) => statusColors[status]};
  line-height: 1;
`;

const Unit = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 400;
  color: #8a8a8a;
`;

export const StatusCard: React.FC<StatusCardProps> = ({
  label,
  value,
  max,
  unit,
  status
}) => {
  const displayValue = max ? `${value}/${max}` : value.toFixed(1);
  const displayUnit = unit || (max ? '' : '');

  return (
    <CardContainer status={status}>
      <Label>{label}</Label>
      <ValueContainer>
        <Value status={status}>{displayValue}</Value>
        {displayUnit && <Unit>{displayUnit}</Unit>}
      </ValueContainer>
    </CardContainer>
  );
};
