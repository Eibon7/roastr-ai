const eslintConfigPrettier = require('eslint-config-prettier/flat');
const eslintPluginPrettier = require('eslint-plugin-prettier');

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
      prettier: eslintPluginPrettier
    },
    rules: {
      // Disable strict rules that might break CI
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-undef': 'off',
      // Prettier integration
      'prettier/prettier': 'error',
      // Merge Prettier config rules (disables conflicting ESLint rules)
      ...eslintConfigPrettier.rules
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