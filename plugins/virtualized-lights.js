/*
 * virtualized-scenes
 */

const request = require('request-promise-native');
const forEach = require('lodash/forEach');

let lights = {};

const lightChanged = ({ lightId, payload }) => {
  const light = lights[lightId];

  reduceColorMethod(payload, light.state);

  if (payload.on === false) {
    console.log('Light turned off, forgetting settings');
    light.state = {
      on: false,
    };
  } else {
    light.state = {
      ...light.state,
      ...payload,
    };
  }
};

const cacheIgnoreFields = [
  'transitiontime',
  'alert',
  'bri_inc',
  'sat_inc',
  'hue_inc',
  'ct_inc',
  'xy_inc',
];

// TODO: handle xy array
const shouldUpdate = (field, oldValue, newValue) => {
  if (cacheIgnoreFields.includes(field)) {
    return true;
  }

  if (oldValue !== newValue) {
    return true;
  }

  return false;
};

// Three methods of updating light color, only one can be used with the
// following priority: xy > ct > hs
const reduceColorMethod = (payload, state) => {
  if (payload.xy) {
    delete state.ct;
    delete state.hue;
    delete state.sat;
  } else if (payload.ct) {
    delete state.xy;
    delete state.hue;
    delete state.sat;
  } else if (payload.hue || payload.sat) {
    delete state.xy;
    delete state.ct;
  }
};

const setLight = ({ lightId, payload }) => {
  // console.log('setLight()', payload);
  const light = lights[lightId];

  reduceColorMethod(payload, payload);

  // Figure out fields that have changed as a result of this setLight call
  const needsUpdate = { ...payload };

  forEach(
    payload,
    (value, field) =>
      shouldUpdate(field, light.state[field], value)
        ? lightChanged({ lightId, payload: { [field]: value } })
        : delete needsUpdate[field],
  );

  // If no updates needed, don't send request
  if (!Object.keys(needsUpdate).length) {
    return;
  }

  try {
    // console.log(lightId, needsUpdate);
    return request({
      url: `http://${process.env.HUE_IP}/api/${process.env
        .USERNAME}/lights/${lightId}/state`,
      method: 'PUT',
      body: needsUpdate,
      json: true,
      timeout: 1000,
    });
  } catch (e) {
    console.log('setLight() failed with error:', e);
  }
};

exports.register = async function(server, options, next) {
  if (!process.env.USERNAME) {
    return next(
      'virtualized-lights: USERNAME env var not supplied, aborting...',
    );
  }

  // Discover existing lights
  lights = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/lights`,
    timeout: 1000,
    json: true,
  });

  server.on('start', () => {
    server.on('setLight', setLight);
    server.on('lightChanged', lightChanged);
  });

  server.event('setLight');
  server.event('lightChanged');

  next();
};

exports.register.attributes = {
  name: 'virtualized-lights',
  version: '1.0.0',
};