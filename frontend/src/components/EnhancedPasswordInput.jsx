import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './ui/input';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';

const EnhancedPasswordInput = ({ 
  value, 
  onChange, 
  placeholder = "Contraseña",
  showStrength = true,
  showCriteria = true,
  className = "",
  id,
  name,
  required = false,
  autoComplete,
  disabled = false,
  ...props 
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Validate password strength for minimum requirements
  const isPasswordValid = (password) => {
    if (!password) return false;
    
    const criteria = [
      password.length >= 8,
      /[A-Z]/.test(password) || /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password), // At least uppercase OR special char
      /[a-z]/.test(password),
      /\d/.test(password),
      !/\s/.test(password) // No spaces
    ];
    
    // At least 4 out of 5 criteria must be met
    const passedCriteria = criteria.filter(Boolean).length;
    return passedCriteria >= 4;
  };

  return (
    <div className="space-y-3">
      {/* Password Input with Toggle */}
      <div className="relative">
        <Input
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`pr-12 ${className} ${
            value && !isPasswordValid(value) 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
              : value && isPasswordValid(value)
              ? 'border-green-300 focus:border-green-500 focus:ring-green-500'
              : ''
          }`}
          id={id}
          name={name}
          required={required}
          autoComplete={autoComplete}
          disabled={disabled}
          {...props}
        />
        
        {/* Toggle Password Visibility */}
        {value && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
            onClick={togglePasswordVisibility}
            disabled={disabled}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Password Strength Indicator */}
      {(showStrength || showCriteria) && (
        <PasswordStrengthIndicator 
          password={value} 
          showCriteria={showCriteria}
        />
      )}
    </div>
  );
};

export default EnhancedPasswordInput;