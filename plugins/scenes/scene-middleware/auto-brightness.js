/*
 * auto-brightness
 *
 * Automatically scales light brightness according to time of day
 *
 */

const nightBrightness = 0.2;
const dayBrightness = 1;

// Hours to brightness
const brightnessMap = {
  7: 0.3,
  8: 0.5,
  9: 0.7,
  10: 0.9,
  11: dayBrightness,
  12: dayBrightness,
  13: dayBrightness,
  14: dayBrightness,
  15: dayBrightness,
  16: dayBrightness,
  17: dayBrightness,
  18: 0.9,
  19: 0.8,
  20: 0.75,
  21: 0.65,
  22: 0.5,
  23: 0.3,
};

const getCurBrightness = () => {
  const hour = new Date().getHours();
  const prevBrightness = brightnessMap[hour] || nightBrightness;
  const nextBrightness = brightnessMap[(hour + 1) % 24] || nightBrightness;

  const weight = new Date().getMinutes() / 60;

  // Interpolate between prevSettings and nextSettings
  return (1 - weight) * prevBrightness + weight * nextBrightness;
};

const sceneMiddleware = ({ scene }) => {
  for (lightId in scene.lightstates) {
    const light = scene.lightstates[lightId];

    if (light.bri !== undefined) {
      light.bri = Math.round(light.bri * getCurBrightness());
    } else {
      light.bri = Math.round(254 * getCurBrightness());
    }
  }
};

const register = async function(server, options) {
  server.events.on('start', () => {
    server.events.on('sceneMiddleware', sceneMiddleware);
  });
};

module.exports = {
  name: 'auto-brightness',
  version: '1.0.0',
  register,
};
