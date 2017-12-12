/*
 * sunlight
 *
 * When `options.sceneId` is active, simulates sunlight by varying brightness
 * and color temperature of all lights in the scene.
 *
 * DEPENDENCIES:
 *
 * - virtualized-scenes
 *
 * SETUP:
 *
 * - Register dependencies and plugin in index.js:
 *
 * ```
 * server.register(
 *   [
 *     {
 *       register: require('./plugins/scenes/sunlight'),
 *       options: { sceneId: '<some existing Hue scene>' }
 *     ...
 *   ]
 * ...
 * ```
 */

const forEach = require('lodash/forEach');

let scene = null;
let colorTimeout = null;

const kelvinToMired = kelvin => 1000000 / kelvin;
const night = kelvinToMired(2000);
const day = kelvinToMired(4000);

// Missing hours will use night settings
const timeMap = {
  7: kelvinToMired(2200),
  8: kelvinToMired(2500),
  9: kelvinToMired(3000),
  10: kelvinToMired(3500),
  11: day,
  12: day,
  13: day,
  14: day,
  15: day,
  16: day,
  17: day,
  18: kelvinToMired(3500),
  19: kelvinToMired(3000),
  20: kelvinToMired(2500),
};

const setColors = (server, options) => {
  const hour = new Date().getHours();
  const prevCt = timeMap[hour] || night;
  const nextCt = timeMap[(hour + 1) % 24] || night;

  const weight = new Date().getMinutes() / 60;

  // Interpolate between prevCt and nextCt
  const timeSettings = {
    ct: Math.round((1 - weight) * prevCt + weight * nextCt),
  };

  const lightstates = scene.lightstates;

  scene.lights.forEach(lightId => {
    lightstates[lightId] = {
      ...lightstates[lightId],
      ...timeSettings,
      transitiontime: options.delayMs / 100,
    };
  });

  server.events.emit('modifyScene', {
    sceneId: options.sceneId,
    payload: {
      lightstates,
    },
  });
};

const loop = (server, options) => () => {
  setColors(server, options);

  // 10 second intervals
  colorTimeout = setTimeout(loop(server, options), options.delayMs);
};

const sceneMiddleware = options => ({ sceneId, prevSceneId, scene }) => {
  if (sceneId === options.sceneId && prevSceneId !== sceneId) {
    // Scene was just activated, don't use transitiontime
    forEach(scene.lightstates, light => delete light.transitiontime);
  }
};

const register = async function(server, options) {
  options.delayMs = options.delayMs || 1000 * 10;

  server.events.on('start', () => {
    scene = server.plugins['virtualized-scenes'].scenes[options.sceneId];

    server.events.on('sceneMiddleware', sceneMiddleware(options));

    loop(server, options)();
  });
};

module.exports = {
  name: 'scenes/sunlight',
  version: '1.0.0',
  register,
};
