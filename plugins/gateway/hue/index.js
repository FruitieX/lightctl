const { initConfig } = require('./config');
const { initApi } = require('./api');

const register = async (server, options) => {
  const hueConfig = await initConfig(options);

  initApi(server, hueConfig);
};

module.exports = {
  name: 'gateway/hue',
  version: '1.0.0',
  register,
};
