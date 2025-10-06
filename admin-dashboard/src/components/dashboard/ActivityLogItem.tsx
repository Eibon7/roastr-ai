import React from 'react';
import styled from 'styled-components';

interface ActivityLogItemProps {
  timestamp: string;
  event: string;
  isLast?: boolean;
}

const ItemContainer = styled.div<{ $isLast?: boolean }>`
  min-height: 40px;
  padding: 8px 0;
  border-bottom: ${({ $isLast }) => $isLast ? 'none' : '1px solid rgba(255, 255, 255, 0.08)'};
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const Timestamp = styled.div`
  flex-shrink: 0;
  width: 60px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  font-weight: 400;
  color: #8a8a8a;
  line-height: 1.5;
`;

const EventText = styled.div`
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 400;
  color: #bdbdbd;
  line-height: 1.5;
`;

export const ActivityLogItem: React.FC<ActivityLogItemProps> = ({
  timestamp,
  event,
  isLast
}) => {
  return (
    <ItemContainer $isLast={isLast}>
      <Timestamp>{timestamp}</Timestamp>
      <EventText>{event}</EventText>
    </ItemContainer>
  );
};
