module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: '18' } }],
  ],
  plugins: [
    '@babel/plugin-transform-optional-chaining',
    '@babel/plugin-transform-nullish-coalescing-operator',
    '@babel/plugin-transform-class-properties',
    '@babel/plugin-transform-private-methods',
  ],
};