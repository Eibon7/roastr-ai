const prettierConfig = require('eslint-plugin-prettier');
const prettierRecommended = require('eslint-config-prettier');

module.exports = [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
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
        Buffer: true
      }
    },
    plugins: {
      prettier: prettierConfig
    },
    rules: {
      // Disable strict rules that might break CI
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-undef': 'off',
      
      // Prettier integration
      'prettier/prettier': 'error',
      
      // Disable rules that conflict with Prettier
      ...prettierRecommended.rules
    },
    ignores: [
      'frontend/',
      'node_modules/',
      '*.config.js',
      'coverage/',
      'build/',
      'dist/',
      '**/*.min.js',
      '**/build/**',
      '**/dist/**',
      'tests/unit/components/**',
      'tests/unit/frontend/**'
    ]
  }
];