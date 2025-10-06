import React from 'react';
import styled from 'styled-components';

interface CornerSeparatorProps {
  variant?: 'default' | 'success';
  position?: 'top' | 'bottom' | 'both';
}

const SeparatorContainer = styled.div<{ variant: 'default' | 'success'; position: string }>`
  position: absolute;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;

  ${({ position }) => (position === 'top' || position === 'both') && `
    &::before,
    &::after {
      content: '';
      position: absolute;
      top: 0;
      width: 8px;
      height: 8px;
      border-color: ${({ variant }) => variant === 'success' ? '#50fa7b' : 'rgba(255, 255, 255, 0.12)'};
      border-style: solid;
    }

    &::before {
      left: 0;
      border-width: 1px 0 0 1px;
    }

    &::after {
      right: 0;
      border-width: 1px 1px 0 0;
    }
  `}

  ${({ position }) => (position === 'bottom' || position === 'both') && `
    ${position === 'both' ? '&' : '&::before, &::after'} {
      ${position === 'both' ? `
        &::before::after,
        &::after::after
      ` : ''}
      content: '';
      position: absolute;
      bottom: 0;
      width: 8px;
      height: 8px;
      border-color: ${({ variant }) => variant === 'success' ? '#50fa7b' : 'rgba(255, 255, 255, 0.12)'};
      border-style: solid;
    }

    ${position === 'both' ? '&::before::after' : '&::before'} {
      left: 0;
      border-width: 0 0 1px 1px;
    }

    ${position === 'both' ? '&::after::after' : '&::after'} {
      right: 0;
      border-width: 0 1px 1px 0;
    }
  `}
`;

export const CornerSeparator: React.FC<CornerSeparatorProps> = ({
  variant = 'default',
  position = 'top'
}) => {
  return <SeparatorContainer variant={variant} position={position} />;
};
