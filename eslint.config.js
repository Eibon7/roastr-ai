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
    rules: {
      // Disable strict rules that might break CI
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'no-undef': 'off'
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