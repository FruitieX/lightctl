/*
 * config-spoofer
 *
 * Spoofs bridge config in Hue API endpoints.
 * In order to masquerade as a separate bridge, we need to spoof several Hue config
 * fields related to bridge ID, IP address, name.
 */

const dummy = require('./dummy');
const request = require('request-promise-native');

const modifyConfig = (body, hueConfig) => {
  let config = body.config ? body.config : body;

  if (config.name) {
    config.name = hueConfig.forwarderName;
  }
  if (config.ipaddress) {
    config.ipaddress = hueConfig.forwarderAddr;
  }
  if (config.mac) {
    config.mac = hueConfig.forwarderMac;
  }
  if (config.bridgeid) {
    config.bridgeid = hueConfig.forwarderID;
  }

  return body;
};

exports.initConfigSpoofer = (server, hueConfig) =>
  server.route([
    {
      method: 'GET',
      path: '/api/{username}/config',
      handler: async (req, h) => {
        if (hueConfig.dummy) {
          if (req.params.username === 'nouser') {
            // Unauthenticated response
            return dummy.getConfigUnauthenticated(hueConfig);
          } else {
            // Authenticated response
            return dummy.getConfigAuthenticated(hueConfig);
          }
        } else {
          console.log(
            `Forwarding (and spoofing): ${req.method} ${req.url.path}`,
          );

          const response = await request({
            url: `http://${hueConfig.bridgeAddr}${req.url.path}`,
            method: req.method,
            body: req.payload || undefined,
            json: true,
          });

          console.log('response', response);

          return modifyConfig(response, hueConfig);
        }
      },
    },
  ]);
