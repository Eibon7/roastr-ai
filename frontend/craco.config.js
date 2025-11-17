module.exports = {
  babel: {
    // Desactivar React Refresh completamente para evitar conflictos en CI
    plugins: [],
  },
  webpack: {
    configure: (config) => {
      const path = require('path');
      
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        ws: false,
        bufferutil: false,
        'utf-8-validate': false,
      };
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        '@': path.resolve(__dirname, 'src'),
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
