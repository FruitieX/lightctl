/*
 * lights
 */

const request = require('request-promise-native');
const forEach = require('lodash/forEach');

let lights = {};

// TODO: a lot of Hue specific stuff should live inside plugins

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

// These fields are not idempotent so we should ignore their cached values
const cacheIgnoreFields = [
  'transitiontime',
  'alert',
  'bri_inc',
  'sat_inc',
  'hue_inc',
  'ct_inc',
  'xy_inc',
];

// These are no-op by themselves
const modifierFields = ['transitiontime'];

const containsOnlyModifierFields = payload => {
  let onlyModifiers = true;

  Object.keys(payload).forEach(key => {
    if (!modifierFields.includes(key)) {
      onlyModifiers = false;
    }
  });

  return onlyModifiers;
};

const shouldUpdate = (field, oldValue, newValue) => {
  if (cacheIgnoreFields.includes(field)) {
    return true;
  }

  if (field === 'xy') {
    if (!oldValue) {
      return true;
    }

    // Compare both xy components
    if (oldValue[0] !== newValue[0] || oldValue[1] !== newValue[1]) {
      return true;
    }
  } else if (oldValue !== newValue) {
    return true;
  }

  // console.log('skipping identical value for field', field, oldValue);
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

const sanitizeValues = payload => {
  if (payload.bri) {
    payload.bri = Math.max(0, Math.min(254, payload.bri));
  }
};

const setLight = ({ lightId, payload }) => {
  // console.log('setLight()', payload);
  const light = lights[lightId];

  reduceColorMethod(payload, payload);

  // Figure out fields that have changed as a result of this setLight call
  const needsUpdate = { ...payload };

  // It seems that lights which are off forget settings randomly, so only
  // run shouldUpdate() for lights which are on
  if (light.state.on) {
    forEach(
      payload,
      (value, field) =>
        shouldUpdate(field, light.state[field], value)
          ? lightChanged({ lightId, payload: { [field]: value } })
          : delete needsUpdate[field],
    );
  } else {
    lightChanged({ lightId, payload });

    // Light is off, if we don't send an on command, don't send request
    if (!needsUpdate.on) {
      return;
    }
  }

  // If no updates needed, don't send request
  if (
    !Object.keys(needsUpdate).length ||
    containsOnlyModifierFields(needsUpdate)
  ) {
    return;
  }

  sanitizeValues(needsUpdate);

  // If turning light off, never send 'bri' as that seems to break fading out
  if (needsUpdate.on === false) {
    delete needsUpdate.bri;
  }

  try {
    console.log('lights: sending lightstate updates to', lightId, needsUpdate);

    // TODO: move to hue-api.js
    return request({
      url: `http://${server.config.hue.bridgeAddr}/api/${
        server.config.hue.username
      }/lights/${lightId}/state`,
      method: 'PUT',
      body: needsUpdate,
      json: true,
      timeout: 1000,
    });
  } catch (e) {
    console.log('setLight() failed with error:', e);
  }
};

const register = async function(server, options) {
  /*
  if (!server.config.hue.username) {
    throw 'lights: USERNAME env var not supplied, aborting...';
  }
  */

  server.events.on('start', async () => {
    // TODO: light discovery (plugins should do this, and we should support updates)
    /*
    // Discover existing lights
    lights = await server.emitAwait('getLights');
    */

    server.events.on('setLight', setLight);
    server.events.on('lightChanged', lightChanged);
  });

  server.event({ name: 'getLights', clone: true });
  server.event({ name: 'setLight', clone: true });
  server.event({ name: 'lightChanged', clone: true });
};

module.exports = {
  name: 'lights',
  version: '1.0.0',
  register,
};
