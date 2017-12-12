const { initConfig } = require('./config');
const { initConfigSpoofer } = require('./config-spoofer');
const { initSSDPServer } = require('./ssdp');
const { initApi } = require('./api');

const register = async (server, options) => {
  const hueConfig = await initConfig(options);

  initConfigSpoofer(server, hueConfig);
  initSSDPServer(server, hueConfig);
  initApi(server, hueConfig);
};

module.exports = {
  name: 'hue',
  version: '1.0.0',
  register,
};
