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

const cloneDeep = require('lodash/cloneDeep');
const forEach = require('lodash/forEach');

const nextColor = (server, options, state) => {
  const offsetLight = Object.values(state.initialStates)[
    (state.lightIndex + state.offset) % state.scene.lights.length
  ];

  const lightId = state.scene.lights[state.lightIndex];

  if (offsetLight.xy) {
    state.scene.lightstates[lightId].xy = offsetLight.xy;
  }
  if (offsetLight.ct) {
    state.scene.lightstates[lightId].ct = offsetLight.ct;
  }
  state.scene.lightstates[lightId].transitiontime = Math.round(
    state.options.delayMs * state.scene.lights.length / 100,
  );

  server.emit('modifyScene', {
    sceneId: options.sceneId,
    payload: { lightstates: state.scene.lightstates },
  });

  state.lightIndex = (state.lightIndex + 1) % state.scene.lights.length;

  if (!state.lightIndex) {
    // If lightIndex wrapped around, increase offset
    state.offset = (state.offset + 1) % state.scene.lights.length;
  }

  state.colorTimeout = setTimeout(
    () => nextColor(server, options, state),
    state.options.delayMs,
  );
};

const sceneMiddleware = options => ({ sceneId, prevSceneId, scene }) => {
  if (sceneId === options.sceneId && prevSceneId !== sceneId) {
    // Scene was just activated, don't use transitiontime
    forEach(scene.lightstates, light => delete light.transitiontime);
  }
};

exports.register = async function(server, options, next) {
  options.delayMs = options.delayMs || 3000;

  server.on('start', () => {
    const scene = server.plugins['virtualized-scenes'].scenes[options.sceneId];

    const state = {
      colorTimeout: null,
      lightIndex: 0,
      offset: 0,
      scene: cloneDeep(scene),
      initialStates: cloneDeep(scene.lightstates),
      options,
    };

    server.on('sceneMiddleware', sceneMiddleware(options));

    state.colorTimeout = setTimeout(
      () => nextColor(server, options, state),
      state.options.delayMs,
    );
  });

  next();
};

exports.register.attributes = {
  name: 'scenes/colorloop',
  version: '1.0.0',
  multiple: true,
};
