// babel.config.cjs
module.exports = (api) => {
  const isTest = api.env('test');
  const isIntegrationTest = process.env.npm_lifecycle_event === 'test:integration';

  const presets = [
    ['@babel/preset-env', { targets: { node: 'current' } }]
  ];

  // Add React preset only for integration tests that use React
  if (isTest && isIntegrationTest) {
    presets.push(['@babel/preset-react', { runtime: 'automatic' }]);
  }

  return {
    presets,
    plugins: [
      '@babel/plugin-transform-optional-chaining',
      '@babel/plugin-transform-nullish-coalescing-operator',
      '@babel/plugin-proposal-class-properties',
      '@babel/plugin-proposal-private-methods'
    ]
  };
};
