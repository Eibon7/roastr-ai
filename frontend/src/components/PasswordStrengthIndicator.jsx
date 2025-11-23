import React from 'react';
import { Check, X, AlertCircle } from 'lucide-react';

const PasswordStrengthIndicator = ({ password, showCriteria = true }) => {
  // Password validation criteria
  const criteria = [
    {
      id: 'length',
      label: 'Al menos 8 caracteres',
      test: (pwd) => pwd.length >= 8,
      severity: 'high'
    },
    {
      id: 'uppercase',
      label: 'Al menos una mayúscula (A-Z)',
      test: (pwd) => /[A-Z]/.test(pwd),
      severity: 'medium'
    },
    {
      id: 'lowercase',
      label: 'Al menos una minúscula (a-z)',
      test: (pwd) => /[a-z]/.test(pwd),
      severity: 'medium'
    },
    {
      id: 'number',
      label: 'Al menos un número (0-9)',
      test: (pwd) => /\d/.test(pwd),
      severity: 'medium'
    },
    {
      id: 'special',
      label: 'Al menos un carácter especial (!@#$%^&*)',
      test: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
      severity: 'high'
    },
    {
      id: 'noSpaces',
      label: 'Sin espacios en blanco',
      test: (pwd) => !/\s/.test(pwd),
      severity: 'low'
    }
  ];

  // Calculate password strength
  const getPasswordStrength = () => {
    if (!password) return { score: 0, level: 'none', color: 'gray' };

    const passedCriteria = criteria.filter((criterion) => criterion.test(password));
    const score = passedCriteria.length;
    const totalCriteria = criteria.length;

    // Calculate strength based on criteria passed and their severity
    const highSeverityPassed = passedCriteria.filter((c) => c.severity === 'high').length;
    const mediumSeverityPassed = passedCriteria.filter((c) => c.severity === 'medium').length;

    let level, color;

    if (score === 0) {
      level = 'none';
      color = 'gray';
    } else if (score <= 2 || highSeverityPassed === 0) {
      level = 'weak';
      color = 'red';
    } else if (score <= 4 || (highSeverityPassed === 1 && mediumSeverityPassed < 2)) {
      level = 'fair';
      color = 'yellow';
    } else if (score <= 5) {
      level = 'good';
      color = 'green';
    } else {
      level = 'strong';
      color = 'green';
    }

    return { score, level, color, totalCriteria };
  };

  const strength = getPasswordStrength();

  const getStrengthText = () => {
    switch (strength.level) {
      case 'none':
        return 'Ingrese una contraseña';
      case 'weak':
        return 'Débil';
      case 'fair':
        return 'Regular';
      case 'good':
        return 'Buena';
      case 'strong':
        return 'Muy fuerte';
      default:
        return '';
    }
  };

  const getStrengthProgress = () => {
    const percentage = (strength.score / strength.totalCriteria) * 100;
    return Math.min(percentage, 100);
  };

  if (!password && !showCriteria) return null;

  return (
    <div className="space-y-3">
      {/* Strength Bar */}
      {password && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Fortaleza de la contraseña
            </span>
            <span
              className={`text-sm font-medium ${
                strength.color === 'red'
                  ? 'text-red-600'
                  : strength.color === 'yellow'
                    ? 'text-yellow-600'
                    : strength.color === 'green'
                      ? 'text-green-600'
                      : 'text-gray-500'
              }`}
            >
              {getStrengthText()}
            </span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                strength.color === 'red'
                  ? 'bg-red-500'
                  : strength.color === 'yellow'
                    ? 'bg-yellow-500'
                    : strength.color === 'green'
                      ? 'bg-green-500'
                      : 'bg-gray-300'
              }`}
              style={{ width: `${getStrengthProgress()}%` }}
            />
          </div>
        </div>
      )}

      {/* Criteria List */}
      {showCriteria && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Requisitos de contraseña:
          </div>
          <div className="space-y-1">
            {criteria.map((criterion) => {
              const isValid = password && criterion.test(password);
              const isRequired = criterion.severity === 'high';

              return (
                <div
                  key={criterion.id}
                  className={`flex items-center space-x-2 text-sm ${
                    isValid
                      ? 'text-green-600 dark:text-green-400'
                      : password
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {isValid ? (
                      <Check className="h-4 w-4" />
                    ) : password ? (
                      <X className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                  </div>
                  <span className="flex-1">
                    {criterion.label}
                    {isRequired && <span className="ml-1 text-red-500 font-medium">*</span>}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            * Campos obligatorios para una contraseña segura
          </div>
        </div>
      )}
    </div>
  );
};

export default PasswordStrengthIndicator;
