const { initConfig } = require('./config');
const { initApi } = require('./api');
const { initSwitches } = require('./switches');

const register = async (server, options) => {
  const hueConfig = await initConfig(options);
  await initApi(server, hueConfig);

  if (hueConfig.switches) {
    await initSwitches(server, hueConfig);
  }
};

module.exports = {
  name: 'gateway/hue',
  version: '1.0.0',
  register,
};
