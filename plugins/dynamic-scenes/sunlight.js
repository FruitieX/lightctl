/*
 * sunlight
 *
 * When `options.sceneId` is active, simulates sunlight by varying brightness
 * and color temperature of all lights in the scene.
 *
 */

const R = require('ramda');
const { modifyScene } = require('../../src/scenes');
const state = require('../../src/state');

let scene = null;
let colorTimeout = null;

const night = 2000;
const day = 4000;

// Missing hours will use night settings
const timeMap = {
  7: 2200,
  8: 2500,
  9: 3000,
  10: 3500,
  11: day,
  12: day,
  13: day,
  14: day,
  15: day,
  16: day,
  17: day,
  18: 3500,
  19: 3000,
  20: 2500,
};

const setColors = (server, options) => {
  const hour = new Date().getHours();
  const prevCt = timeMap[hour] || night;
  const nextCt = timeMap[(hour + 1) % 24] || night;

  const weight = new Date().getMinutes() / 60;

  // Interpolate between prevCt and nextCt
  const ct = Math.round((1 - weight) * prevCt + weight * nextCt);

  scene = state.get(['scenes', 'entries', options.sceneId]);

  scene = R.map(l => ({ ct: [ct, l.ct[1] || 100] }), scene);

  modifyScene({
    sceneId: options.sceneId,
    scene,
    transitionTime: options.delayMS / 100,
  });
};

const loop = (server, options) => () => {
  setColors(server, options);

  // 10 second intervals
  colorTimeout = setTimeout(loop(server, options), options.delayMs);
};

const register = async function(server, options) {
  options.delayMs = options.delayMs || 1000 * 10;

  server.events.on('start', () => {
    loop(server, options)();
  });
};

module.exports = {
  name: 'scenes/sunlight',
  version: '1.0.0',
  register,
};
