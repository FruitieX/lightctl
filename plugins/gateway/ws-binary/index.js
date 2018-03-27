/*
 * ws
 *
 * WebSockets using the ws library
 *
 * Sample configuration:
 *
 * plugins:
 *   ./plugins/gateway/ws:
 *     port: 1234
 */

const convert = require('color-convert');
const WebSocket = require('ws');
const {
  luminaireRegister,
  getLuminaire,
  getLuminaires,
} = require('../../../src/lights');

const dither = (val, cutoff) => {
  return cutoff > val - Math.floor(val) ? Math.floor(val) : Math.ceil(val);
}

const send = ws => () => {
  if (ws.bufferedAmount) {
    //console.log('buffer full');
    return;
  }

  const array = new Uint8Array(ws.luminaire.lights.length * 3);

  ws.luminaire.lights.forEach((light, index) => {
    const currentState = [...light.getState().currentState];

    // current limiter :-)
    //currentState[2] = currentState[2] / 2;

    if (currentState[2]) {
      // cap value because dither looks terrible at extremely low brightness
      currentState[2] = Math.max(4, currentState[2]);
    }

    const rgb = convert.hsv.rgb.raw(currentState);

    const cutoff = Math.random();

      array[index * 3 + 0] = dither(rgb[0], cutoff);
      array[index * 3 + 1] = dither(rgb[1], cutoff);
      array[index * 3 + 2] = dither(rgb[2], cutoff);
      //array[index * 3 + 0] = dither(255, cutoff);
      //array[index * 3 + 1] = dither(255, cutoff);
      //array[index * 3 + 2] = dither(255, cutoff);
  });

  ws.send(array, (err) => {
    if (err) {
      console.log(err);
    }
  });
}

const register = async function(server, options) {
  const wss = new WebSocket.Server({ port: options.port || 1234 });

  /*
  server.events.on('luminaireUpdate', luminaire => {
    if (luminaire.gateway === 'ws') {
      wss.clients.forEach(function each(client) {
        if (client.id === luminaire.id && client.readyState === WebSocket.OPEN) {
          send(client, luminaire);
        }
      });
    }
  });
  */
  wss.on('error', err => {
    console.log('websocket error:', err);
  });

  wss.on('connection', function connection(ws) {
    // Only possible inbound message is a register message
    ws.on('message', function incoming(message) {
      const json = JSON.parse(message);

      if (!json.id) {
        return ws.send({ err: "id field must be provided." });
      }

      console.log('ws-binary:', json, 'registered.');

      ws.id = json.id;

      luminaireRegister({
        ...json,
        gateway: 'ws-binary',
      });

      ws.luminaire = getLuminaire(ws.id);
      ws.interval = setInterval(send(ws), 5);
    });

    ws.on('close', err => {
      clearInterval(ws.interval);
      console.log('ws-binary client disconnected');
    });

    ws.on('error', err => {
      clearInterval(ws.interval);
      console.log(err)
    });
  });
};

module.exports = {
  name: 'gateway/ws-binary',
  version: '1.0.0',
  register,
};
