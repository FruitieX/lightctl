/*
 * colorloop
 *
 * When `options.sceneId` is active, cycle all scene lights through all
 * colors in scene.
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
 *       register: require('./plugins/scenes/colorloop'),
 *       options: { sceneId: '<id of a Hue scene>' }
 *     ...
 *   ]
 * ...
 * ```
 */

const registerScene = require('../dynamic-scenes').registerScene;
let scene = null;

const nextColor = state => {
  const offsetLight = Object.values(state.scene.lightstates)[
    (state.lightIndex + state.offset) % state.scene.lights.length
  ];

  const lightId = state.scene.lights[state.lightIndex];

  scene.setLight(lightId, {
    xy: offsetLight.xy ? offsetLight.xy : undefined,
    ct: offsetLight.ct ? offsetLight.ct : undefined,
    transitiontime: Math.round(
      state.config.delayMs * state.scene.lights.length / 100,
    ),
  });

  state.lightIndex = (state.lightIndex + 1) % state.scene.lights.length;

  if (!state.lightIndex) {
    // If lightIndex wrapped around, increase offset
    state.offset = (state.offset + 1) % state.scene.lights.length;
  }

  state.colorTimeout = setTimeout(() => nextColor(state), state.config.delayMs);
};

exports.register = async function(server, options, next) {
  server.dependency(['scene-spy']);
  const config = options;
  config.delayMs = config.delayMs || 3000;

  try {
    scene = await registerScene(config.sceneId);

    const state = {
      colorTimeout: null,
      lightIndex: 0,
      offset: 0,
      scene,
      config,
    };

    scene.events.on('activate', async () => {
      state.lightIndex = 0;
      state.offset = 0;

      clearTimeout(state.colorTimeout);
      state.colorTimeout = null;

      state.colorTimeout = setTimeout(
        () => nextColor(state),
        state.config.delayMs,
      );

      console.log(`colorloop activated for scene ${config.sceneId}`);
    });

    scene.events.on('deactivate', () => {
      clearTimeout(state.colorTimeout);
      state.colorTimeout = null;

      console.log(`colorloop deactivated for scene ${config.sceneId}`);
    });

    next();
  } catch (e) {
    next(e);
  }
};

exports.register.attributes = {
  name: 'scenes/colorloop',
  version: '1.0.0',
  multiple: true,
};
