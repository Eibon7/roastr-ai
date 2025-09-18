import React, { useState, useEffect } from 'react'
import ThresholdSlider from './ui/ThresholdSlider'
import InfoTooltip from './ui/InfoTooltip'

const PRESETS = {
  lenient: {
    τ_roast_lower: 0.35,
    τ_shield: 0.80,
    τ_critical: 0.95
  },
  balanced: {
    τ_roast_lower: 0.25,
    τ_shield: 0.70,
    τ_critical: 0.90
  },
  strict: {
    τ_roast_lower: 0.15,
    τ_shield: 0.50,
    τ_critical: 0.80
  }
}

const ShieldSettings = ({
  settings,
  onChange,
  disabled = false
}) => {
  const [validationErrors, setValidationErrors] = useState([])

  useEffect(() => {
    validateSettings(settings)
  }, [settings])

  const validateSettings = (currentSettings) => {
    const errors = []
    
    const { τ_roast_lower, τ_shield, τ_critical } = currentSettings

    // Check range constraints
    if (τ_roast_lower < 0 || τ_roast_lower > 1) {
      errors.push('Roast threshold must be between 0 and 1')
    }
    if (τ_shield < 0 || τ_shield > 1) {
      errors.push('Shield threshold must be between 0 and 1')
    }
    if (τ_critical < 0 || τ_critical > 1) {
      errors.push('Critical threshold must be between 0 and 1')
    }

    // Check ordering constraints
    if (τ_shield <= τ_roast_lower) {
      errors.push('Shield threshold must be greater than roast threshold')
    }
    if (τ_critical <= τ_shield) {
      errors.push('Critical threshold must be greater than shield threshold')
    }

    setValidationErrors(errors)
  }

  const handleEnabledChange = (e) => {
    onChange({
      ...settings,
      enabled: e.target.checked
    })
  }

  const handlePresetChange = (preset) => {
    if (preset === 'custom') {
      onChange({
        ...settings,
        preset: 'custom'
      })
    } else {
      onChange({
        ...settings,
        preset,
        ...PRESETS[preset]
      })
    }
  }

  const handleThresholdChange = (field, value) => {
    onChange({
      ...settings,
      preset: 'custom',
      [field]: value
    })
  }

  const isValid = validationErrors.length === 0

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 text-blue-600">
          <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Shield Settings</h3>
          <p className="text-sm text-gray-600">
            Configure automated moderation thresholds and actions
          </p>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="shield-enabled"
          checked={settings.enabled}
          onChange={handleEnabledChange}
          disabled={disabled}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
        />
        <label htmlFor="shield-enabled" className="text-sm font-medium text-gray-700">
          Enable Shield Protection
        </label>
        <InfoTooltip content="When enabled, Shield will automatically moderate toxic content based on your configured thresholds">
          <div className="w-4 h-4 text-gray-400 cursor-help">
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        </InfoTooltip>
      </div>

      {/* Preset Configuration */}
      <fieldset disabled={disabled || !settings.enabled} className="space-y-3">
        <legend className="text-sm font-medium text-gray-700">Preset Configuration</legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { id: 'lenient', label: 'Lenient', description: 'High tolerance, fewer actions' },
            { id: 'balanced', label: 'Balanced', description: 'Recommended for most users' },
            { id: 'strict', label: 'Strict', description: 'Low tolerance, more actions' },
            { id: 'custom', label: 'Custom', description: 'Manual configuration' }
          ].map((preset) => (
            <label key={preset.id} className="relative flex flex-col p-3 border rounded-lg cursor-pointer hover:bg-gray-50 disabled:opacity-50">
              <input
                type="radio"
                name="preset"
                value={preset.id}
                checked={settings.preset === preset.id}
                onChange={() => handlePresetChange(preset.id)}
                disabled={disabled || !settings.enabled}
                className="sr-only"
              />
              <div className={`text-sm font-medium ${settings.preset === preset.id ? 'text-blue-700' : 'text-gray-900'}`}>
                {preset.label}
              </div>
              <div className="text-xs text-gray-500">
                {preset.description}
              </div>
              {settings.preset === preset.id && (
                <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none" />
              )}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Threshold Configuration */}
      <div className="space-y-6">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <div className="w-4 h-4">
            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </div>
          Threshold Configuration
        </h4>

        <div className="grid gap-6 md:grid-cols-3">
          <ThresholdSlider
            label="Roast Generation Threshold"
            value={settings.τ_roast_lower}
            onChange={(value) => handleThresholdChange('τ_roast_lower', value)}
            disabled={disabled || !settings.enabled}
            help="Minimum toxicity level required to generate a roast response"
            error={validationErrors.find(error => error.includes('Roast threshold'))}
          />

          <ThresholdSlider
            label="Shield Activation Threshold"
            value={settings.τ_shield}
            onChange={(value) => handleThresholdChange('τ_shield', value)}
            disabled={disabled || !settings.enabled}
            help="Toxicity level at which Shield begins moderation actions"
            error={validationErrors.find(error => error.includes('Shield threshold'))}
          />

          <ThresholdSlider
            label="Critical Action Threshold"
            value={settings.τ_critical}
            onChange={(value) => handleThresholdChange('τ_critical', value)}
            disabled={disabled || !settings.enabled}
            help="Toxicity level for immediate critical actions (blocking, reporting)"
            error={validationErrors.find(error => error.includes('Critical threshold'))}
          />
        </div>
      </div>

      {/* Validation Status */}
      <div className="p-4 rounded-lg border">
        {isValid ? (
          <div className="flex items-center gap-2 text-green-600">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium">Configuration is valid</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-red-600">
              <div className="w-5 h-5">
                <svg className="w-full h-full" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-sm font-medium">Configuration errors:</span>
            </div>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index} className="text-sm text-red-600" role="alert">
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Threshold Visualization */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <h5 className="text-sm font-medium text-gray-700 mb-3">Threshold Visualization</h5>
        <div className="relative h-8 bg-gradient-to-r from-green-200 via-yellow-200 to-red-200 rounded">
          {/* Threshold markers */}
          <div 
            className="absolute top-0 h-full w-0.5 bg-blue-600"
            style={{ left: `${settings.τ_roast_lower * 100}%` }}
            title={`Roast: ${Math.round(settings.τ_roast_lower * 100)}%`}
          />
          <div 
            className="absolute top-0 h-full w-0.5 bg-orange-600"
            style={{ left: `${settings.τ_shield * 100}%` }}
            title={`Shield: ${Math.round(settings.τ_shield * 100)}%`}
          />
          <div 
            className="absolute top-0 h-full w-0.5 bg-red-600"
            style={{ left: `${settings.τ_critical * 100}%` }}
            title={`Critical: ${Math.round(settings.τ_critical * 100)}%`}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0% (Safe)</span>
          <span>100% (Toxic)</span>
        </div>
      </div>
    </div>
  )
}

export default ShieldSettings