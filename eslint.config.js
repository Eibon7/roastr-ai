const prettierConfig = require('eslint-plugin-prettier');
const prettierRecommended = require('eslint-config-prettier');
const babelParser = require('@babel/eslint-parser');
const reactPlugin = require('eslint-plugin-react');

module.exports = [
  // Ignore patterns (must be first in flat config)
  {
    ignores: [
      'frontend/**',
      'apps/frontend/**',
      'apps/frontend-v2/**',
      'node_modules/**',
      '*.config.js',
      'coverage/**',
      'build/**',
      'dist/**',
      '**/*.min.js',
      '**/build/**',
      '**/dist/**'
    ]
  },
  // Main configuration - ONLY lint apps/backend-v2/** and scripts/**
  {
    files: ['apps/backend-v2/**/*.{js,jsx}', 'scripts/**/*.{js,jsx}'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        requireConfigFile: false,
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        node: true,
        jest: true,
        process: true,
        console: true,
        require: true,
        module: true,
        __dirname: true,
        __filename: true,
        global: true,
        Buffer: true,
        React: 'readonly',
        JSX: 'readonly'
      }
    },
    plugins: {
      prettier: prettierConfig,
      react: reactPlugin
    },
    rules: {
      // Disable strict rules that might break CI
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-undef': 'off',
      
      // Prettier integration
      'prettier/prettier': 'error',
      
      // React rules (minimal, just to avoid JSX parsing errors)
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      
      // Disable unsupported TypeScript rules (not available in this config)
      '@typescript-eslint/no-dynamic-delete': 'off',
      
      // Disable rules that conflict with Prettier
      ...prettierRecommended.rules
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  }
];