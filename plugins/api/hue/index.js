/*
 * Hue API
 *
 * Support Hue apps by exposing lightctl as a fake Hue bridge
 *
 * Sample configuration:
 *
 * ./plugins/api/hue:
 *   forwarderName: lightctl
 */

const { initConfig } = require('./config');
const { initSSDPServer } = require('./ssdp');
const { initApi } = require('./api');

const register = async (server, options) => {
  const hueConfig = await initConfig(options);

  initSSDPServer(server, hueConfig);
  initApi(server, hueConfig);
};

module.exports = {
  name: 'api/hue',
  version: '1.0.0',
  register,
};
