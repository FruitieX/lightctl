/*
 * config-spoofer
 *
 * Spoofs bridge config in Hue API endpoints.
 * In order to masquerade as a separate bridge, we need to spoof several Hue config
 * fields related to bridge ID, IP address, name.
 */

const request = require('request');

const doForward = (req, cb) =>
  request(
    {
      url: `http://${process.env.HUE_IP}${req.url.path}`,
      method: req.method,
      headers: req.headers,
      body: req.payload && JSON.stringify(req.payload),
    },
    cb,
  );

const modifyBody = body => {
  let config = body.config ? body.config : body;

  if (config.mac) {
    config.mac = process.env.FORWARDER_MAC;
  }
  if (config.bridgeid) {
    config.bridgeid = process.env.BRIDGE_ID
  }
  if (config.ipaddress) {
    config.ipaddress = process.env.FORWARDER_IP;
  }
  if (config.name) {
    config.name = process.env.BRIDGE_NAME;
  }

  return body;
};

exports.register = function (server, options, next) {
  server.route([
    {
      method: 'GET',
      path: '/api/{username}/config',
      handler: (req, reply) =>
        doForward(req, (err, hueRes) =>
          reply(modifyBody(JSON.parse(hueRes.body))),
        ),
    },
    {
      method: 'GET',
      path: '/api/{username}',
      handler: (req, reply) =>
        doForward(req, (err, hueRes) =>
          reply(modifyBody(JSON.parse(hueRes.body))),
        ),
    }
  ]);

  next();
};

exports.register.attributes = {
  name: 'config-spoofer',
  version: '1.0.0'
};
