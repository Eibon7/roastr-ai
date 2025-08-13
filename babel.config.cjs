// babel.config.cjs
module.exports = (api) => {
  const isTest = api.env('test');
  const isIntegrationTest = process.env.npm_lifecycle_event?.includes('integration-backend');
  
  const presets = [
    ['@babel/preset-env', { targets: { node: 'current' } }]
  ];
  
  // Add React preset only for integration tests that use JSX
  if (isTest && isIntegrationTest) {
    presets.push(['@babel/preset-react', { runtime: 'automatic' }]);
  }
  
  return {
    presets,
    plugins: [
      '@babel/plugin-transform-optional-chaining',
      '@babel/plugin-transform-nullish-coalescing-operator',
      '@babel/plugin-transform-class-properties',
      '@babel/plugin-transform-private-methods',
    ],
  };
};