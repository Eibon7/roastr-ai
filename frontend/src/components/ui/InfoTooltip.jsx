import React, { useState, useRef, useId } from 'react'

const InfoTooltip = ({ 
  content, 
  children, 
  position = 'top',
  className = '' 
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const tooltipId = useId()
  const timeoutRef = useRef(null)

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(true)
  }

  const hideTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false)
    }, 100)
  }

  const handleMouseEnter = () => {
    showTooltip()
  }

  const handleMouseLeave = () => {
    if (!isFocused) {
      hideTooltip()
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
    showTooltip()
  }

  const handleBlur = () => {
    setIsFocused(false)
    hideTooltip()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsVisible(!isVisible)
    }
    if (e.key === 'Escape') {
      setIsVisible(false)
    }
  }

  if (!content) return children

  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
  }

  return (
    <div className={`relative inline-block ${className}`}>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-describedby={isVisible ? tooltipId : undefined}
        aria-label="Show tooltip"
        tabIndex={0}
        className="inline-block"
      >
        {children}
      </div>
      
      {isVisible && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`
            absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg
            max-w-xs whitespace-normal break-words
            ${positionClasses[position]}
          `}
        >
          {content}
        />
      )}
    </div>
  )
}

export default InfoTooltip