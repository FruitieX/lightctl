const http = require('http');
const Hapi = require('hapi');
const request = require('request');
const SsdpServer = require('node-ssdp').Server;

const FORWARDER_PORT = 80;
const FORWARDER_IP = '192.168.1.104';
const FORWARDER_MAC = 'ac:bc:32:c0:92:35';
const HUE_IP = '192.168.1.111';

const ssdp = new SsdpServer({
  adInterval: 2000,
  ssdpSig: 'Linux/3.14.0 UPnP/1.0 IpBridge/1.16.0',
  location: `http://${FORWARDER_IP}:${FORWARDER_PORT}/description.xml`,
  udn: `uuid:2f402f80-da50-11e1-9b23-${FORWARDER_MAC}`,
  // 'hue-bridgeid': `${FORWARDER_MAC.toUpperCase()}`,
});

ssdp.addUSN('urn:schemas-upnp-org:device:basic:1');

ssdp.start();

const modifyBody = body => {
  let config = body.config ? body.config : body;

  if (config.mac) {
    config.mac = FORWARDER_MAC;
  }
  if (config.bridgeid) {
    config.bridgeid = FORWARDER_MAC.toUpperCase().replace(/:/g, '');
  }
  if (config.ipaddress) {
    config.ipaddress = FORWARDER_IP;
  }
  if (config.name) {
    config.name = `${config.name} (Forwarded)`;
  }

  return body;
};

const forwarder = new Hapi.Server();
forwarder.connection({ port: FORWARDER_PORT });

const doForward = (req, cb) =>
  request(
    {
      url: `http://${HUE_IP}${req.url.path}`,
      method: req.method,
      headers: req.headers,
      body: req.payload && JSON.stringify(req.payload),
    },
    cb,
  );

forwarder.route([
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
  },
  {
    method: '*',
    path: '/{p*}',
    handler: (req, reply) => {
      console.log(`${req.method} ${req.url.path}`);

      doForward(req, (err, hueRes) => {
        reply(
          hueRes.headers['content-type'] === 'application/json'
            ? JSON.parse(hueRes.body)
            : hueRes.body,
        );
      });
    },
  },
]);

forwarder.start(err => {
  if (err) {
    throw err;
  }
  console.log(`Server running at: ${forwarder.info.uri}`);
});
