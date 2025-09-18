import React, { useState, useEffect } from 'react'
import InfoTooltip from './InfoTooltip'

const ThresholdSlider = ({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  disabled = false,
  error = null,
  help = null,
  className = ''
}) => {
  // Convert decimal to percentage for display
  const [percentValue, setPercentValue] = useState(Math.round(value * 100))

  useEffect(() => {
    setPercentValue(Math.round(value * 100))
  }, [value])

  const handleSliderChange = (e) => {
    const newPercentValue = parseInt(e.target.value)
    setPercentValue(newPercentValue)
    
    const decimalValue = Math.max(min, Math.min(max, newPercentValue / 100))
    onChange(decimalValue)
  }

  const handleInputChange = (e) => {
    const inputValue = e.target.value
    
    // Allow empty input during typing
    if (inputValue === '') {
      setPercentValue('')
      return
    }

    const newPercentValue = parseInt(inputValue)
    
    if (isNaN(newPercentValue)) return

    setPercentValue(newPercentValue)
    
    // Clamp value to valid range
    const clampedPercent = Math.max(min * 100, Math.min(max * 100, newPercentValue))
    const decimalValue = clampedPercent / 100
    
    onChange(decimalValue)
  }

  const handleInputBlur = () => {
    // Ensure we have a valid number on blur
    if (percentValue === '' || isNaN(percentValue)) {
      const fallbackValue = Math.round(value * 100)
      setPercentValue(fallbackValue)
    } else {
      // Clamp to valid range on blur
      const clampedPercent = Math.max(min * 100, Math.min(max * 100, Number(percentValue)))
      if (clampedPercent !== Number(percentValue)) {
        setPercentValue(clampedPercent)
        onChange(clampedPercent / 100)
      }
    }
  }

  const sliderMin = Math.round(min * 100)
  const sliderMax = Math.round(max * 100)
  const sliderStep = Math.round(step * 100)

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
        {help && (
          <InfoTooltip content={help}>
            <div className="w-4 h-4 text-gray-400 cursor-help">
              <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
          </InfoTooltip>
        )}
      </div>
      
      <div className="space-y-3">
        {/* Slider */}
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={sliderStep}
          value={percentValue}
          onChange={handleSliderChange}
          disabled={disabled}
          aria-label={label}
          className={`
            w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer
            slider:bg-blue-500 slider:rounded-lg
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        />
        
        {/* Number Input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              min={sliderMin}
              max={sliderMax}
              step={sliderStep}
              value={percentValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              disabled={disabled}
              aria-label={`${label} percentage`}
              className={`
                w-full px-3 py-2 text-sm border rounded-md
                focus:ring-2 focus:ring-blue-500 focus:border-transparent
                disabled:bg-gray-100 disabled:cursor-not-allowed
                ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}
              `}
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-gray-500">
              %
            </span>
          </div>
        </div>
      </div>
      
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export default ThresholdSlider