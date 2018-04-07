/*
 * lightctl-udp
 *
 * Lightweight protocol for controlling lights over UDP/IPv4.
 * Uses UDP to avoid retransmission delays and other crap we don't want.
 *
 * Sample configuration:
 *
 * plugins:
 *   ./plugins/gateway/lightctl-udp:
 *     port: 1234
 */

const convert = require('color-convert');
const dgram = require('dgram');
const udpServer = dgram.createSocket('udp4');

const {
  luminaireRegister,
  getLuminaire,
  getLuminaires,
} = require('../../../src/lights');

const clients = [];

const send = client => () => {
  const array = new Uint8Array(client.luminaire.lights.length * 3 + 7); // + 1 is dither flag, + 3 are rgb gamma correction values, + 3 is for contrast

  client.luminaire.lights.forEach((light, index) => {
    const currentState = [...light.getState().currentState];

    const rgb = convert.hsv.rgb.raw(currentState);

    const val = (Math.sin(new Date().getTime() / 1000 + index) + 1) / 2;
    //const val = 1;

    const r = rgb[0] * val;
    const g = rgb[1] * val;
    const b = rgb[2] * val;

    let r_ = Math.floor(r);
    let g_ = Math.floor(g);
    let b_ = Math.floor(b);

    /*
    if (r_) {
      if (g > 0.5 && !g_) g_ = 1;
      if (b > 0.5 && !b_) b_ = 1;
    }
    if (g_) {
      if (r > 0.5 && !r_) r_ = 1;
      if (b > 0.5 && !b_) b_ = 1;
    }
    if (b_) {
      if (r > 0.5 && !r_) r_ = 1;
      if (g > 0.5 && !g_) g_ = 1;
    }
    */

    array[index * 3 + 0] = r_; //r_;
    array[index * 3 + 1] = g_; //g_;
    array[index * 3 + 2] = b_; //b_;
  });

  array[client.luminaire.lights.length * 3] = 4; // enable dithering with 4 steps

  array[client.luminaire.lights.length * 3 + 1] = client.gammaCorrection[0]; // red gamma correction
  array[client.luminaire.lights.length * 3 + 2] = client.gammaCorrection[1]; // green gamma correction
  array[client.luminaire.lights.length * 3 + 3] = client.gammaCorrection[2]; // blue gamma correction
  array[client.luminaire.lights.length * 3 + 4] = client.contrast[0]; // red contrast
  array[client.luminaire.lights.length * 3 + 5] = client.contrast[1]; // green contrast
  array[client.luminaire.lights.length * 3 + 6] = client.contrast[2]; // blue contrast

  udpServer.send(array, 0, array.length, client.port, client.address);
};

const removeClient = client => {
  clearInterval(client.interval);
  const index = clients.findIndex(
    existingClient =>
      existingClient.address === client.address &&
      existingClient.port === client.port,
  );

  console.log('removing idle client', client.id);

  if (index !== -1) {
    clients.splice(index, 1);
  }
};

const setClientTimeout = client => {
  clearTimeout(client.timeout);
  client.timeout = setTimeout(() => {
    removeClient(client);
  }, 30000);
};

const register = async function(server, options) {
  const gammaCorrection = options.gammaCorrection || {};
  const contrast = options.contrast || {};

  udpServer.on('message', (msg, rinfo) => {
    const existingClient = clients.find(
      client => client.address === rinfo.address && client.port === rinfo.port,
    );

    if (existingClient) {
      console.log('got keepalive from', existingClient.id);
      setClientTimeout(existingClient);
      // TODO: re-register luminaire?
    } else {
      let client = { ...rinfo };
      const json = JSON.parse(msg);

      if (!json.id) {
        return console.log('id field must be provided.');
      }

      console.log('lightctl-udp', json, 'registered.');

      client.id = json.id;
      client.gammaCorrection = gammaCorrection[client.id] || [220, 250, 180];
      client.contrast = contrast[client.id] || [255, 255, 255];

      luminaireRegister({
        ...json,
        gateway: 'lightctl-udp',
      });

      setClientTimeout(client);
      client.luminaire = getLuminaire(client.id);
      client.interval = setInterval(send(client), 10);

      clients.push(client);
    }
  });

  udpServer.bind(options.port);
  console.log('lightctl-udp bound to port', options.port);
};

module.exports = {
  name: 'gateway/lightctl-udp',
  version: '1.0.0',
  register,
};
