const { composePlugins, withNx } = require('@nx/webpack');
const webpack = require('webpack');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {
  // Configure for Node.js environment
  config.target = 'node';
  config.node = {
    __dirname: false,
    __filename: false,
  };

  // Ignore web worker files that require browser APIs
  config.plugins = config.plugins || [];
  config.plugins.push(
    new webpack.IgnorePlugin({
      resourceRegExp: /webworker|workerFactory|snarkjsWorker/,
    })
  );

  // Mark web worker modules as externals
  const originalExternals = config.externals || [];
  config.externals = [
    ...(Array.isArray(originalExternals) ? originalExternals : []),
    ({ request }, callback) => {
      if (request && (request.includes('webworker') || request.includes('workerFactory') || request.includes('snarkjsWorker'))) {
        return callback(null, 'commonjs ' + request);
      }
      if (typeof originalExternals === 'function') {
        return originalExternals({ request }, callback);
      }
      callback();
    },
  ];

  // Enable top-level await
  config.experiments = { ...config.experiments, topLevelAwait: true };

  return config;
});

