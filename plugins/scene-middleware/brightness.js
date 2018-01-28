/*
 * brightness
 *
 *
 *
 */

let brightness = 100;
let prevBrightness = 100;
let prevTransitionTime = null;
let prevTransitionStart = null;

const sceneMiddleware = ({ lightCmds }) => {
  lightCmds.forEach(lightCmd => {
    const cmd = lightCmd.cmd;

    const multiplier = brightness / 100;
    if (cmd.rgb) {
      cmd.rgb[0] *= multiplier;
      cmd.rgb[1] *= multiplier;
      cmd.rgb[2] *= multiplier;
    }
    if (cmd.xyY) {
      cmd.xyY[2] *= multiplier;
    }
    if (cmd.ct) {
      cmd.ct[1] *= multiplier;
    }
    if (cmd.hsv) {
      cmd.hsv[2] *= multiplier;
    }
  });
};

const setBrightness = server => ({
  value,
  delta,
  transitionTime = 500,
  useExistingTransition = false,
}) => {
  if (!isNaN(delta)) {
    brightness = prevBrightness + delta;
  }
  if (!isNaN(value)) {
    brightness = value;
  }

  // Limit brightness to [1, 100]
  brightness = Math.max(1, brightness);
  brightness = Math.min(100, brightness);

  server.events.emit('forceSceneUpdate', {
    transitionTime,
    useExistingTransition,
  });

  prevBrightness = brightness;
  prevTransitionTime = transitionTime;
  prevTransitionStart = new Date().getTime();
};

const fadeBrightness = server => ({ rate = 20, updateInterval = 1000 }) => {
  setBrightness(server)({
    delta: rate * updateInterval / 1000,
    transitionTime: updateInterval,
  });
};

const daylightBrightness = (server, options) => initial => {
  // TODO: 0 is not allowed
  const startIncreaseHour = options.daylight.startIncreaseHour || 7;
  const increaseRate = options.daylight.increaseRate || 20;
  const max = options.daylight.max || 100;

  const startDecreaseHour = options.daylight.startDecreaseHour || 19;
  const decreaseRate = options.daylight.decreaseRate || 15;
  const min = options.daylight.min || 25;

  const updateInterval = options.daylight.updateInterval || 60;

  const hour = new Date().getHours();

  // Estimate for initial brightness
  if (initial) {
    if (hour < startIncreaseHour) {
      // Midnight - early morning
      brightness = min;
    } else if (hour < startDecreaseHour) {
      // Morning - evening
      brightness = Math.min(
        min + (hour - startIncreaseHour) * increaseRate,
        max,
      );
    } else {
      // Evening - midnight
      brightness = Math.max(
        max - (hour - startDecreaseHour) * decreaseRate,
        min,
      );
    }
    console.log('Set initial brightness:', brightness);
    prevBrightness = brightness;
    return;
  }

  if (hour >= startIncreaseHour && hour < startDecreaseHour) {
    if (brightness >= max) {
      // Brightness already at or over max value
      return;
    }

    // Daytime, increase brightness by increaseRate / hour
    const value = Math.min(
      max,
      brightness + increaseRate * (updateInterval / 3600),
    );
    setBrightness(server)({ value, useExistingTransition: true });
  } else {
    if (brightness <= min) {
      // Brightness already at or under min value
      return;
    }

    // Nighttime, decrease brightness by increaseRate / hour
    const value = Math.max(
      min,
      brightness + decreaseRate * (updateInterval / 3600),
    );
    setBrightness(server)({ value, useExistingTransition: true });
  }
};

const register = async function(server, options) {
  server.event({ name: 'setBrightness', clone: true });

  server.events.on('start', () => {
    server.events.on('sceneMiddleware', sceneMiddleware);
    server.events.on('setBrightness', setBrightness(server));
    //server.events.on('fadeBrightness', fadeBrightness(server));

    if (options.daylight) {
      const updateInterval = options.daylight.updateInterval || 60;
      setInterval(daylightBrightness(server, options), updateInterval * 1000);
      daylightBrightness(server, options)(true);
    }
  });
};

module.exports = {
  name: 'brightness',
  version: '1.0.0',
  register,
};
