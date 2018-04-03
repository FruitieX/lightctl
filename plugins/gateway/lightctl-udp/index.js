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
  const array = new Uint8Array(client.luminaire.lights.length * 3 + 1); // + 1 is dither flag

  client.luminaire.lights.forEach((light, index) => {
    const currentState = [...light.getState().currentState];

    const rgb = convert.hsv.rgb.raw(currentState);

    const val = (Math.sin(new Date().getTime() / 500 + index) + 1) / 2;
    array[index * 3 + 0] = rgb[0] * val;
    array[index * 3 + 1] = rgb[1] * val;
    array[index * 3 + 2] = rgb[2] * val;
  });

  array[client.luminaire.lights.length * 3] = 8; // enable dithering with 8 steps

  udpServer.send(array, 0, array.length, client.port, client.address);
};

const removeClient = client => {
  clearInterval(client.interval);
  const index = clients.findIndex(
    existingClient => existingClient.address === client.address && existingClient.port === client.port,
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
