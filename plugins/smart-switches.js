/*
 * smart-switches
 *
 * Perform actions based on Hue dimmer switch button presses.
 *
 * To reduce the amount of endpoints we need to poll, create a special "button
 * sensor" in the bridge, which the dimmer switches can report button presses
 * to. If you have multiple dimmer switches you now only need to poll the button
 * sensor instead of each individual dimmer switch sensor.
 *
 * The button sensor is represented by a CLIPGenericStatus type sensor in the
 * bridge, and is automatically created if autoCreateSensor is enabled.
 *
 * Dimmer switches can be programmed to update the button sensors by appending
 * the following to the actions array of each dimmer switch rule (replace
 * ${SENSOR_ID} and ${SCENE_ID} with relevant values):
 *
 * ```
 * {
 *   "address": "/sensors/${SENSOR_ID}",
 *   "method": "PUT",
 *   "body": {
 *     "name": "${SCENE_ID}"
 *   }
 * }
 * ```
 *
 * NOTE: Special SCENE_ID values include:
 *
 * - "off": Turn group lights off
 * - "null": No active scene (e.g. after manual light state change)
 *
 * SETUP:
 *
 * - Register plugin in index.js:
 *
 * ```
 * server.register(
 *   [
 *     {
 *       register: require('./plugins/scene-spy'),
 *       options: {
 *         groups: [0, 1],
 *         pollDelay: 100,
 *         sceneSensors: true,
 *         autoCreateSensors: true,
 *       },
 *     },
 *   ...
 */

const pickBy = require('lodash/pickBy');
const forEach = require('lodash/forEach');
const findKey = require('lodash/findKey');

const request = require('request-promise-native');

const delay = ms => new Promise((resolve, reject) => setTimeout(resolve, ms));

const startPolling = async (server, buttonSensorId, options) => {
  while (true) {
    try {
      const buttonSensor = await request({
        url: `http://${process.env.HUE_IP}/api/${process.env
          .USERNAME}/sensors/${buttonSensorId}`,
        timeout: 1000,
        json: true,
      });

      const [switchId, state] = buttonSensor.name.split(',');

      // Button sensor has unhandled event
      if (state) {
        console.log(
          `smart-switches: Got button ${state} press on switch ${switchId}`,
        );

        const switchActions = options.switchActions[switchId];

        if (switchActions && switchActions[state]) {
          switchActions[state].forEach(({ event, ...payload }) =>
            server.emit(event, payload),
          );
        }

        // Mark scene activation as handled
        await request({
          url: `http://${process.env.HUE_IP}/api/${process.env
            .USERNAME}/sensors/${buttonSensorId}`,
          timeout: 1000,
          method: 'PUT',
          body: {
            name: 'null',
          },
          json: true,
        });
      }
    } catch (e) {
      console.log('Error while polling for button events:', e);
    }

    await delay(options.pollDelay || 100);
  }
};

// We only care about HOLD and SHORT_RELEASED states on on/off buttons
const BUTTON_STATES = {
  // ON_PRESSED: 1000,
  ON_HOLD: 1001,
  ON_SHORT_RELEASED: 1002,
  // ON_LONG_RELEASED: 1003,

  UP_PRESSED: 2000,
  UP_HOLD: 2001,
  UP_SHORT_RELEASED: 2002,
  UP_LONG_RELEASED: 2003,

  DOWN_PRESSED: 3000,
  DOWN_HOLD: 3001,
  DOWN_SHORT_RELEASED: 3002,
  DOWN_LONG_RELEASED: 3003,

  // OFF_PRESSED: 4000,
  OFF_HOLD: 4001,
  OFF_SHORT_RELEASED: 4002,
  // OFF_LONG_RELEASED: 4003,
};

const createButtonEventAction = (buttonSensorId, sensorId, state) => ({
  address: `/sensors/${buttonSensorId}`,
  body: {
    name: `${sensorId},${state}`,
  },
  method: 'PUT',
});
const buttonEventAddress = /\/sensors\/(\d+)\/state\/buttonevent/;

exports.register = async function(server, options, next) {
  if (!process.env.USERNAME) {
    return next('smart-switches: USERNAME env var not supplied, aborting...');
  }

  // Discover existing sensors
  let sensors = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/sensors`,
    timeout: 1000,
    json: true,
  });

  // Find button sensor if one exists
  let buttonSensorId = findKey(
    sensors,
    sensor => sensor.modelid === 'Button Sensor',
  );

  // Create button sensor if it does not exist
  if (!buttonSensorId) {
    const [result] = await request({
      url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/sensors`,
      timeout: 1000,
      method: 'POST',
      body: {
        name: 'null',
        modelid: `Button Sensor`,
        swversion: '1',
        type: 'CLIPGenericStatus',
        uniqueid: `buttonsensor`,
        manufacturername: 'smart-switches',
      },
      json: true,
    });

    buttonSensorId = result.success.id;
  }

  // Pick out dimmer switches
  const switches = pickBy(sensors, sensor => sensor.modelid === 'RWL021');

  // Set each sensor rule to null until we discover or create them
  forEach(switches, sensor => {
    sensor.rules = {};

    forEach(BUTTON_STATES, (code, state) => {
      sensor.rules[state] = null;
    });
  });

  // Discover existing rules
  let rules = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/rules`,
    timeout: 1000,
    json: true,
  });

  // Map existing rules to sensor events
  forEach(rules, (rule, ruleId) => {
    rule.conditions.forEach(condition => {
      const match = condition.address.match(buttonEventAddress);

      if (match) {
        const [result, sensorId] = match;
        const code = condition.value;

        const buttonState = findKey(BUTTON_STATES, state => state == code);

        if (!buttonState) {
          console.log(
            `smart-switches: unknown button state ${code} on rule ${ruleId}`,
          );
        } else {
          switches[sensorId].rules[buttonState] = ruleId;
        }
      }
    });
  });

  // Reprogram switch rules to work as smart-switches
  for (const sensorId in switches) {
    const sensor = switches[sensorId];
    //forEach(switches, (sensor, sensorId) => {
    for (const state in sensor.rules) {
      const ruleId = sensor.rules[state];
      //forEach(sensor.rules, (ruleId, state) => {

      const buttonEventAction = createButtonEventAction(
        buttonSensorId,
        sensorId,
        state,
      );

      if (ruleId === null) {
        // Rule doesn't exist, create it
        console.log(
          `smart-switches: creating rule for switch ${sensorId} ${state}`,
        );

        const [result] = await request({
          url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/rules`,
          timeout: 1000,
          method: 'POST',
          body: {
            name: `Switch ${sensorId} ${state}`,
            conditions: [
              {
                address: `/sensors/${sensorId}/state/buttonevent`,
                operator: 'eq',
                value: String(BUTTON_STATES[state]), // API expects this to be a string for whatever reason
              },
            ],
            actions: [buttonEventAction],
          },
          json: true,
        });

        sensor.rules[state] = result.success.id;
      } else {
        // Rule exists, modify it to work as smart-switch
        console.log(
          `smart-switches: modifying rule for switch ${sensorId} ${state}`,
        );

        const rule = rules[ruleId];

        rule.name = `Switch ${sensorId} ${state}`;

        // Make sure an action exists for updating the button sensor
        // (and that it is correct and up to date)
        const actionId = findKey(
          rule.actions,
          action => action.address === `/sensors/${buttonSensorId}`,
        );

        if (actionId !== undefined) {
          // Update existing action
          rule.actions[actionId] = buttonEventAction;
        } else {
          // Create new action
          rule.actions.push(buttonEventAction);
        }

        // Bridge does not like us sending these fields back
        delete rule.timestriggered;
        delete rule.owner;
        delete rule.created;
        delete rule.lasttriggered;
        delete rule.recycle;

        const result = await request({
          url: `http://${process.env.HUE_IP}/api/${process.env
            .USERNAME}/rules/${ruleId}`,
          timeout: 1000,
          method: 'PUT',
          body: rule,
          json: true,
        });

        // TODO: error handling
      }
    }
  }

  server.on('start', () => {
    console.log(`smart-switches: Starting polling switches...`);
    startPolling(server, buttonSensorId, options);
  });

  next();
};

exports.register.attributes = {
  name: 'smart-switches',
  version: '1.0.0',
};
