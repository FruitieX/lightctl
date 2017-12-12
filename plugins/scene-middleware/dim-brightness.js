/*
 * dim-brightness
 *
 * Allows dimming/brightening active scene
 *
 */

let minValue = 0; // Hue lights are at minimum value at 0 brightness (not off!)
let maxValue = 10;
let multiplier = 1;
let multiplierChanged = false;
let rateTimeout = null;

const sceneMiddleware = ({ scene, sceneId, prevSceneId, activated }) => {
  // Scene was just activated, reset dimmer value
  if (activated) {
    multiplier = 1;
    multiplierChanged = true;
  }

  for (lightId in scene.lightstates) {
    const light = scene.lightstates[lightId];

    if (light.bri !== undefined) {
      light.bri = Math.round(light.bri * multiplier);
    } else {
      light.bri = Math.round(254 * multiplier);
    }

    if (multiplierChanged) {
      // 1 second transition
      light.transitiontime = 10;
    }
  }

  multiplierChanged = false;
};

const dimBrightness = server => ({ rate }) => {
  multiplierChanged = false;

  const prevMultiplier = multiplier;
  multiplier = Math.max(minValue, Math.min(maxValue, multiplier + rate));

  if (multiplier !== prevMultiplier) {
    multiplierChanged = true;
  }

  server.events.emit('refreshScene');

  clearTimeout(rateTimeout);
  if (rate && multiplierChanged) {
    rateTimeout = setTimeout(() => dimBrightness(server)({ rate }), 1000);
  }
};

const register = async function(server, options) {
  server.events.on('start', () => {
    server.events.on('sceneMiddleware', sceneMiddleware);
    server.events.on('dimBrightness', dimBrightness(server));
  });

  server.event('dimBrightness');
};

module.exports = {
  name: 'dim-brightness',
  version: '1.0.0',
  register,
};
