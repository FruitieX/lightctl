/*
 * party
 *
 * When `options.sceneId` is active, randomly color every light in
 * scene each config.delayMs.
 *
 * DEPENDENCIES:
 *
 * - dynamic-scenes
 *
 * SETUP:
 *
 * - Register dependencies and plugin in index.js:
 *
 * ```
 * server.register(
 *   [
 *     {
 *       register: require('./plugins/scenes/party'),
 *       options: { sceneId: '<some existing Hue scene>' }
 *     ...
 *   ]
 * ...
 * ```
 */

const registerScene = require('../dynamic-scenes').registerScene;

let scene = null;
let colorTimeout = null;
let config = null;

const setColors = async initial => {
  const requests = [];

  scene.lights.forEach(lightId =>
    requests.push(
      scene.setLight(lightId, {
        bri: initial ? scene.lightstates[lightId].bri : undefined,
        on: initial ? scene.lightstates[lightId].on : undefined,
        xy: [Math.random(), Math.random()],
        transitiontime: config.transitiontime || undefined,
      }),
    ),
  );

  return await Promise.all(requests);
};

const loop = async () => {
  await setColors();

  colorTimeout = setTimeout(loop, config.delayMs || 500);
};

const register = async function(server, options) {
  server.dependency(['dynamic-scenes']);
  config = options;

  try {
    scene = await registerScene(config.sceneId);

    scene.events.on('activate', async () => {
      clearTimeout(colorTimeout);
      colorTimeout = null;

      await setColors(true);
      colorTimeout = setTimeout(loop, config.delayMs || 500);
    });

    scene.events.on('deactivate', () => {
      clearTimeout(colorTimeout);
      colorTimeout = null;
    });
  } catch (e) {
    throw e;
  }
};

module.exports = {
  name: 'scenes/party',
  version: '1.0.0',
  register,
};
