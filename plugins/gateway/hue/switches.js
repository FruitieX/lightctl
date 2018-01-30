/*
 * hue/switches
 *
 * Perform actions based on Hue dimmer switch button presses.
 *
 * To reduce the amount of endpoints we need to poll, create a special "switch
 * sensor" in the bridge, which the dimmer switches can report button presses
 * to. If you have multiple dimmer switches you now only need to poll the switch
 * sensor instead of each individual dimmer switch sensor.
 *
 * The switch sensor is represented by a CLIPGenericStatus type sensor in the
 * bridge, and is automatically created.
 *
 */

const pickBy = require('lodash/pickBy');
const forEach = require('lodash/forEach');
const findKey = require('lodash/findKey');

const request = require('request-promise-native');

const delay = ms => new Promise((resolve, reject) => setTimeout(resolve, ms));

let sensors = {};

const startPolling = async (server, hueConfig, switchSensorId) => {
  while (true) {
    try {
      const buttonSensor = await request({
        url: `http://${hueConfig.bridgeAddr}/api/${
          hueConfig.username
        }/sensors/${switchSensorId}`,
        timeout: 1000,
        json: true,
      });

      const [switchId, state] = buttonSensor.name.split(',');

      // Button sensor has unhandled event
      if (state) {
        const sensor = sensors[switchId];

        if (sensor) {
          const switchName = sensor.name;
          const switchActions = hueConfig.switches[switchName];

          console.log(
            `hue/switches: Got button ${state} press on switch: ${switchName}`,
          );

          if (switchActions && switchActions[state]) {
            forEach(switchActions[state], (payload, event) => {
              console.log(
                `hue/switches: Invoking event ${event} with payload ${JSON.stringify(
                  payload,
                )}`,
              );
              server.events.emit(event, payload);
            });
          }
        }

        // Mark event as handled
        await request({
          url: `http://${hueConfig.bridgeAddr}/api/${
            hueConfig.username
          }/sensors/${switchSensorId}`,
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

    await delay(hueConfig.switchPollDelay || 100);
  }
};

// We only care about HOLD and SHORT_RELEASED states on on/off buttons
// TODO: autodetect based on config?
const BUTTON_STATES = {
  // ON_PRESSED: 1000,
  ON_HOLD: 1001,
  ON_SHORT_RELEASED: 1002,
  // ON_LONG_RELEASED: 1003,

  UP_PRESSED: 2000,
  //UP_HOLD: 2001,
  UP_SHORT_RELEASED: 2002,
  UP_LONG_RELEASED: 2003,

  DOWN_PRESSED: 3000,
  //DOWN_HOLD: 3001,
  DOWN_SHORT_RELEASED: 3002,
  DOWN_LONG_RELEASED: 3003,

  //OFF_PRESSED: 4000,
  OFF_HOLD: 4001,
  OFF_SHORT_RELEASED: 4002,
  // OFF_LONG_RELEASED: 4003,
};

const createButtonEventAction = (switchSensorId, sensorId, state) => ({
  address: `/sensors/${switchSensorId}`,
  body: {
    name: `${sensorId},${state}`,
  },
  method: 'PUT',
});
const buttonEventAddress = /\/sensors\/(\d+)\/state\/buttonevent/;

exports.initSwitches = async function(server, hueConfig) {
  if (hueConfig.dummy) {
    return console.log('hue/switches: disabled in dummy mode');
  }

  // Discover existing sensors
  sensors = await request({
    url: `http://${hueConfig.bridgeAddr}/api/${hueConfig.username}/sensors`,
    timeout: 1000,
    json: true,
  });

  // Find switch sensor if one exists
  let switchSensorId = findKey(
    sensors,
    sensor => sensor.modelid === 'Switch Sensor',
  );

  // Create switch sensor if it does not exist
  if (!switchSensorId) {
    const [result] = await request({
      url: `http://${hueConfig.bridgeAddr}/api/${hueConfig.username}/sensors`,
      timeout: 1000,
      method: 'POST',
      body: {
        name: 'null',
        modelid: `Switch Sensor`,
        swversion: '1',
        type: 'CLIPGenericStatus',
        uniqueid: `switchsensor`,
        manufacturername: 'smart-switches',
      },
      json: true,
    });

    switchSensorId = result.success.id;

    console.log(
      `hue/switches: Created switch sensor with ID ${switchSensorId}`,
    );
  } else {
    console.log(`hue/switches: Using switch sensor with ID ${switchSensorId}`);
  }

  // Pick out dimmer switches
  const switches = pickBy(sensors, sensor => sensor.type === 'ZLLSwitch');

  // Set each sensor rule to null until we discover or create them
  forEach(switches, sensor => {
    sensor.rules = {};

    forEach(BUTTON_STATES, (code, state) => {
      sensor.rules[state] = null;
    });
  });

  // Discover existing rules
  let rules = await request({
    url: `http://${hueConfig.bridgeAddr}/api/${hueConfig.username}/rules`,
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
            `hue/switches: unknown button state ${code} on rule ${ruleId}`,
          );
        } else {
          switches[sensorId].rules[buttonState] = ruleId;
        }
      }
    });
  });

  // Reprogram dimmer switch rules to work as special "switch sensors"
  for (const sensorId in switches) {
    const sensor = switches[sensorId];
    for (const state in sensor.rules) {
      const ruleId = sensor.rules[state];

      const buttonEventAction = createButtonEventAction(
        switchSensorId,
        sensorId,
        state,
      );

      if (ruleId === null) {
        // Rule doesn't exist, create it
        console.log(
          `hue/switches: creating rule for switch: ${sensor.name} (${state})`,
        );

        const [result] = await request({
          url: `http://${hueConfig.bridgeAddr}/api/${hueConfig.username}/rules`,
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
          `hue/switches: modifying rule for switch: ${sensor.name} (${state})`,
        );

        const rule = rules[ruleId];

        rule.name = `Switch ${sensorId} ${state}`;

        // Overwrite any old actions
        rule.actions = [buttonEventAction];

        // Make sure an action exists for updating the switch sensor
        // (and that it is correct and up to date)
        // const actionId = findKey(
        //   rule.actions,
        //   action => action.address === `/sensors/${switchSensorId}`,
        // );
        //
        // if (actionId !== undefined) {
        //   // Update existing action
        //   rule.actions[actionId] = buttonEventAction;
        // } else {
        //   // Create new action
        //   rule.actions.push(buttonEventAction);
        // }

        // Bridge does not like us sending these fields back
        delete rule.timestriggered;
        delete rule.owner;
        delete rule.created;
        delete rule.lasttriggered;
        delete rule.recycle;

        const result = await request({
          url: `http://${hueConfig.bridgeAddr}/api/${
            hueConfig.username
          }/rules/${ruleId}`,
          timeout: 1000,
          method: 'PUT',
          body: rule,
          json: true,
        });

        // TODO: error handling
      }
    }
  }

  server.events.on('start', async () => {
    console.log(`hue/switches: Start polling switches...`);
    startPolling(server, hueConfig, switchSensorId);
  });
};
