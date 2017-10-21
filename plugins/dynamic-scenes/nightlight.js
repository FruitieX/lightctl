/*
 * nightlight
 *
 * When `options.sceneId` is active, activates nightlights by fading out
 * lights slowly to a very warm color, then turning off all lights except
 * ones with "on=true" in the bridge scene
 *
 * DEPENDENCIES:
 *
 * - dynamic-scenes
 *
 * SETUP:
 *
 * - Create a nightlight scene through the Hue app with desired lights left on
 *   at desired brightness, note down the sceneId
 *
 * - Register dependencies and plugin in index.js:
 *
 * ```
 * server.register(
 *   [
 *     {
 *       register: require('./plugins/scenes/nightlight'),
 *       options: { sceneId: '<id of nightlight Hue scene>' }
 *     ...
 *   ]
 * ...
 * ```
 */

const shuffle = require('lodash').shuffle;
const request = require('request-promise-native');
const registerScene = require('../dynamic-scenes').registerScene;

let scene = null;
let offTimeout = null;
let config = null;

let nextIndex = 0;
let lightsToTurnOff = [];

const delay = ms =>
  new Promise((resolve, reject) => (offTimeout = setTimeout(resolve, ms)));

const notifyActivation = async () => {
  const lights = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/lights`,
    method: 'GET',
    json: true,
  });

  const groupId = 0;

  let multiplier = 1;
  let maxBrightness = 0;

  Object.entries(lights).forEach(([lightId, light]) => {
    if (light.state.bri > maxBrightness) {
      maxBrightness = light.state.bri;
    }
  });

  if (maxBrightness > 128) {
    multiplier = -2;
  }

  await scene.setGroup(groupId, {
    bri_inc: 50 * multiplier,
    transitiontime: 2,
  });
  await delay(300);
  await scene.setGroup(groupId, {
    bri_inc: -50 * multiplier,
    transitiontime: 2,
  });
  return await delay(1000);
};

const fadeLights = () =>
  scene.lights.forEach(lightId =>
    scene.setLight(lightId, {
      bri: scene.lightstates[lightId].on ? scene.lightstates[lightId].bri : 0,
      xy: config.xy || [0.6, 0.4],
      transitiontime: Math.round((config.transitionMs || 60000) / 100),
    }),
  );

// Lights fade off with intentional "popcorn" effect
const lightsOff = () => {
  const lightId = lightsToTurnOff[nextIndex++];
  console.log(`Turning off light ${lightId}`);

  // Apparently setting transitiontime here makes the light turn off much
  // faster than without? So leaving it out for a smoother fade
  scene.setLight(lightId, { on: false });

  if (nextIndex >= lightsToTurnOff.length) {
    console.log('All lights turned off.');
    return;
  }

  const jitter =
    (config.minOffJitter || 500) + Math.random() * (config.offJitter || 1500);

  offTimeout = setTimeout(lightsOff, jitter);
};

exports.register = async function(server, options, next) {
  server.dependency(['scene-spy']);
  config = options;

  try {
    scene = await registerScene(config.sceneId);

    scene.events.on('activate', async () => {
      if (!offTimeout) {
        await notifyActivation();
      } else {
        clearTimeout(offTimeout);
        offTimeout = null;
      }

      fadeLights();

      nextIndex = 0;
      lightsToTurnOff = [];
      shuffle(Object.entries(scene.lightstates)).forEach(([lightId, state]) => {
        if (!state.on) {
          lightsToTurnOff.push(lightId);
        }
      });

      offTimeout = setTimeout(
        lightsOff,
        Math.round(config.transitionMs || 60000),
      );

      console.log('nightlight activated: fading out lights');
    });

    scene.events.on('deactivate', () => {
      clearTimeout(offTimeout);
      offTimeout = null;

      console.log('nightlight deactivated');
    });

    next();
  } catch (e) {
    next(e);
  }
};

exports.register.attributes = {
  name: 'scenes/nightlight',
  version: '1.0.0',
};
