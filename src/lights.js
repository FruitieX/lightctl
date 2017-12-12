/*
 * lights
 */

const request = require('request-promise-native');
const forEach = require('lodash/forEach');

let lightsCache = {};
let server;

const setLights = lights => {
  console.log('setLights()', JSON.stringify(lights));
  //const light = lights[lightId];

  //console.log('lights: sending lightstate updates to', lightId, needsUpdate);

  lights.forEach(light => {
    lightsCache[light.id] = {
      ...lightsCache[light.id],
      ...light,
    };
  });

  server.events.emit('lightsChanged', lights);
};

const getLights = () => lightsCache;

const register = async function(_server, options) {
  server = _server;
  /*
  if (!server.config.hue.username) {
    throw 'lights: USERNAME env var not supplied, aborting...';
  }
  */

  server.events.on('start', async () => {
    // TODO: light discovery (plugins should do this, and we should support updates)
    /*
    // Discover existing lights
    lights = await server.emitAwait('getLights');
    */
    //server.events.on('setLights', setLights);
    //server.events.on('getLights', getLights);
    // server.events.on('lightChanged', lightChanged);
  });

  server.event({ name: 'lightsChanged', clone: true });
  server.event({ name: 'registerLights', clone: true });
  server.event({ name: 'removeLights', clone: true });
  server.event({ name: 'setLights', clone: true });
  // server.event({ name: 'lightChanged', clone: true });
};

module.exports = {
  name: 'lights',
  version: '1.0.0',
  register,
  getLights,
  setLights,
};
