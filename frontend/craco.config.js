module.exports = {
  babel: {
    plugins: [
      // Solo habilitar React Refresh en desarrollo
      process.env.NODE_ENV === 'development' && 'react-refresh/babel',
    ].filter(Boolean),
  },
  webpack: {
    configure: (config) => {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        ws: false,
        bufferutil: false,
        'utf-8-validate': false,
      };
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        ws: false,
      };
      config.ignoreWarnings = [
        ...(config.ignoreWarnings || []),
        /Critical dependency: the request of a dependency is an expression/,
      ];
      return config;
    },
  },
};
