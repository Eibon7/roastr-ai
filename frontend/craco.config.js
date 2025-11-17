const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

module.exports = {
  babel: {
    // Desactivar React Refresh solo en CI para evitar conflictos
    plugins: process.env.CI ? [] : undefined,
  },
  webpack: {
    configure: (config, { env }) => {
      const path = require('path');
      
      // Remover React Refresh plugin en producción
      if (env === 'production') {
        config.plugins = config.plugins.filter(
          plugin => !(plugin instanceof ReactRefreshWebpackPlugin)
        );
      }
      
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
