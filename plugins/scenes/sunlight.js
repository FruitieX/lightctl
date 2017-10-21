/*
 * sunlight
 *
 * When `options.sceneId` is active, simulates sunlight by varying brightness
 * and color temperature of all lights in the scene.
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
 *       register: require('./plugins/scenes/sunlight'),
 *       options: { sceneId: '<some existing Hue scene>' }
 *     ...
 *   ]
 * ...
 * ```
 */

const request = require('request-promise-native');
const registerScene = require('../dynamic-scenes').registerScene;

let scene = null;
let colorTimeout = null;
let config = null;

const kelvinToMired = kelvin => 1000000 / kelvin;
const night = {
  ct: kelvinToMired(2000),
  bri: 0.25, // 25% of bri value for each light in the bridge scene
};

const day = {
  ct: kelvinToMired(4000),
  bri: 1, // 100% of bri value for each light in the bridge scene
};

// Missing hours will use night settings
const timeMap = {
  7: {
    ct: kelvinToMired(2200),
    bri: 0.3,
  },
  8: {
    ct: kelvinToMired(2500),
    bri: 0.5,
  },
  9: {
    ct: kelvinToMired(3000),
    bri: 0.7,
  },
  10: {
    ct: kelvinToMired(3500),
    bri: 0.9,
  },
  11: day,
  12: day,
  13: day,
  14: day,
  15: day,
  16: day,
  17: day,
  18: {
    ct: kelvinToMired(3500),
    bri: 0.9,
  },
  19: {
    ct: kelvinToMired(3000),
    bri: 0.8,
  },
  20: {
    ct: kelvinToMired(2500),
    bri: 0.75,
  },
  21: {
    ct: kelvinToMired(2000),
    bri: 0.65,
  },
  22: {
    ct: kelvinToMired(2000),
    bri: 0.5,
  },
  23: {
    ct: kelvinToMired(2000),
    bri: 0.3,
  },
};

const setColors = async initial => {
  const requests = [];

  const hour = new Date().getHours();
  const prevSettings = timeMap[hour] || night;
  const nextSettings = timeMap[(hour + 1) % 24] || night;

  const weight = new Date().getMinutes() / 60;

  // Interpolate between prevSettings and nextSettings
  const timeSettings = {
    ct: (1 - weight) * prevSettings.ct + weight * nextSettings.ct,
    bri: (1 - weight) * prevSettings.bri + weight * nextSettings.bri,
  };

  scene.lights.forEach(lightId => {
    const lightState = timeSettings;
    const bri = lightState.bri * scene.lightstates[lightId].bri;

    const body = {
      bri: Math.round(bri),
      ct: Math.round(lightState.ct),
      on: initial ? scene.lightstates[lightId].on : undefined,
      transitiontime: initial ? undefined : 600,
    };

    requests.push(
      request({
        url: `http://${process.env.HUE_IP}/api/${process.env
          .USERNAME}/lights/${lightId}/state`,
        method: 'PUT',
        body,
        json: true,
      }),
    );
  });

  return await Promise.all(requests);
};

const loop = async () => {
  await setColors();

  // 10 second intervals
  colorTimeout = setTimeout(loop, config.delayMs || 1000 * 10);
};

exports.register = async function(server, options, next) {
  server.dependency(['scene-spy']);
  config = options;

  try {
    scene = await registerScene(config.sceneId);

    scene.events.on('activate', async () => {
      clearTimeout(colorTimeout);
      colorTimeout = null;

      await setColors(true);
      colorTimeout = setTimeout(loop, config.delayMs || 1000 * 10);

      console.log('sunlight activated');
    });

    scene.events.on('deactivate', () => {
      clearTimeout(colorTimeout);
      colorTimeout = null;

      console.log('sunlight deactivated');
    });

    next();
  } catch (e) {
    next(e);
  }
};

exports.register.attributes = {
  name: 'scenes/sunlight',
  version: '1.0.0',
};
