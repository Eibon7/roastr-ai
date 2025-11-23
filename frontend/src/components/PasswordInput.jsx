import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import {
  validatePassword,
  getPasswordStrength,
  getPasswordStrengthLabel,
  getPasswordStrengthColor,
  PASSWORD_REQUIREMENTS
} from '../utils/passwordValidator';

const PasswordInput = ({
  value,
  onChange,
  onValidationChange,
  placeholder = 'Contraseña',
  showStrengthIndicator = true,
  showRequirements = true,
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [validation, setValidation] = useState({ isValid: false, errors: [] });
  const [strength, setStrength] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (value) {
      const result = validatePassword(value);
      setValidation(result);
      setStrength(getPasswordStrength(value));

      // Notify parent component about validation status
      if (onValidationChange) {
        onValidationChange(result.isValid);
      }
    } else {
      setValidation({ isValid: false, errors: [] });
      setStrength(0);
      if (onValidationChange) {
        onValidationChange(false);
      }
    }
  }, [value, onValidationChange]);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const requirements = [
    {
      label: `Al menos ${PASSWORD_REQUIREMENTS.minLength} caracteres`,
      met: value.length >= PASSWORD_REQUIREMENTS.minLength
    },
    {
      label: 'Al menos un número',
      met: /\d/.test(value)
    },
    {
      label: 'Al menos una mayúscula o símbolo',
      met: /[A-Z]/.test(value) || /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)
    }
  ];

  return (
    <div className={className}>
      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={`
            appearance-none block w-full px-3 py-2 pr-10 border rounded-md shadow-sm 
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-primary-500 focus:border-primary-500 
            dark:bg-gray-700 dark:text-white
            ${validation.isValid && value ? 'border-green-300 dark:border-green-600' : 'border-gray-300 dark:border-gray-600'}
          `}
          {...props}
        />
        <button
          type="button"
          onClick={togglePasswordVisibility}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>

      {/* Password strength indicator */}
      {showStrengthIndicator && value && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Seguridad:</span>
            <span className={`font-medium px-2 py-1 rounded ${getPasswordStrengthColor(strength)}`}>
              {getPasswordStrengthLabel(strength)}
            </span>
          </div>

          {/* Strength bar */}
          <div className="mt-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                strength === 0
                  ? 'bg-red-500'
                  : strength === 1
                    ? 'bg-orange-500'
                    : strength === 2
                      ? 'bg-yellow-500'
                      : strength === 3
                        ? 'bg-green-500'
                        : 'bg-emerald-500'
              }`}
              style={{ width: `${(strength / 4) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Password requirements */}
      {showRequirements && (isFocused || (value && !validation.isValid)) && (
        <div className="mt-3 space-y-1">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Requisitos de contraseña:
          </p>
          {requirements.map((req, index) => (
            <div key={index} className="flex items-center space-x-2 text-sm">
              {req.met ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <X className="h-4 w-4 text-gray-400" />
              )}
              <span
                className={
                  req.met
                    ? 'text-green-700 dark:text-green-400'
                    : 'text-gray-600 dark:text-gray-400'
                }
              >
                {req.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PasswordInput;
