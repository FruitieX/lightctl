/*
 * scene-spy
 *
 * Figure out active scene by intercepting Hue API scene changes and
 * by polling special "scene" sensors.
 *
 * The scene sensors are represented by CLIPGenericStatus type sensors in the
 * bridge, which are automatically created for each configured group if
 * autoCreateSensors is enabled.
 *
 * Dimmer switches can be programmed to update the scene sensors by appending
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

const EventEmitter = require('events').EventEmitter;
const request = require('request-promise-native');

const groupActionRegex = /\/api\/([\w-]+)\/groups\/(\d+)\/action/;
const lightStateRegex = /\/api\/([\w-]+)\/lights\/(\d+)\/state/;

const sceneSensorForGroup = {};

let groups = {};

const sceneChangeEmitter = new EventEmitter();
exports.sceneChangeEmitter = sceneChangeEmitter;

const emitSceneChange = ({ sceneId, groupId }) => {
  sceneChangeEmitter.emit('activate', { sceneId, groupId });
};

const onPreHandler = (req, reply) => {
  let match;

  if (req.method === 'put') {
    if ((match = req.path.match(groupActionRegex))) {
      // Scene changed for group
      const [result, username, groupId] = match;

      console.log(
        `scene-spy: Group ${groupId} scene changed to: ${req.payload.scene}`,
      );

      emitSceneChange({ groupId, sceneId: req.payload.scene || 'null' });
    } else if ((match = req.path.match(lightStateRegex))) {
      // Light state changed, reset stored scene id to "null"
      const [result, username, lightId] = match;

      // Figure out which group(s) light is part of
      // TODO: can a light be part of multiple groups?
      const groupId = Object.keys(groups).find(groupId =>
        groups[groupId].lights.includes(lightId),
      );

      console.log(
        `scene-spy: Light ${lightId} state changed, scene reset for group ${groupId}`,
      );

      emitSceneChange({ groupId, sceneId: null });
    }
  }

  return reply.continue();
};

const delay = ms => new Promise((resolve, reject) => setTimeout(resolve, ms));

const startPolling = async (server, options) => {
  while (true) {
    const sensors = await request({
      url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/sensors`,
      timeout: 1000,
      json: true,
    });

    for (let groupId in options.groups) {
      //console.log('poll took', new Date().getTime() - time, 'ms');
      const sensorId = sceneSensorForGroup[groupId];
      const sceneId = sensors[sensorId].name;

      // Scene Sensor has changed since previous poll
      if (sceneId !== 'handled') {
        try {
          console.log(
            `scene-spy: Group ${groupId} scene activation detected! (${sceneId})`,
          );

          // Notify listeners
          emitSceneChange({ groupId, sceneId });

          // Mark scene activation as handled
          await request({
            url: `http://${process.env.HUE_IP}/api/${process.env
              .USERNAME}/sensors/${sensorId}`,
            timeout: 1000,
            method: 'PUT',
            body: {
              name: 'handled',
            },
            json: true,
          });
        } catch (e) {
          console.log('Error while handling scene change:', e);
        }
      }
    }

    await delay(options.pollDelay || 100);
  }
};

exports.register = async function(server, options, next) {
  if (!process.env.USERNAME) {
    return next('scene-spy: USERNAME env var not supplied, aborting...');
  }

  server.ext('onPreHandler', onPreHandler);

  // Discover existing groups
  groups = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/groups`,
    timeout: 1000,
    json: true,
  });

  if (options.sceneSensors) {
    // Discover existing sensors
    const sensors = await request({
      url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/sensors`,
      timeout: 1000,
      json: true,
    });

    // Try matching groups to scene sensors
    for (let groupId in options.groups) {
      let sensorId = Object.keys(sensors).find(
        sensorId =>
          sensors[sensorId].modelid === `Group ${groupId} Scene Sensor`,
      );

      if (sensorId === undefined && options.autoCreateSensors) {
        // If scene sensor for group not found, create it
        const generated = await request({
          url: `http://${process.env.HUE_IP}/api/${process.env
            .USERNAME}/sensors`,
          timeout: 1000,
          method: 'POST',
          body: {
            name: 'null',
            modelid: `Group ${groupId} Scene Sensor`,
            swversion: '1',
            type: 'CLIPGenericStatus',
            uniqueid: `group${groupId}`,
            manufacturername: 'Scene Sensor',
          },
          json: true,
        });
        sensorId = generated[0].success.id;
        console.log(
          `scene-spy: Created scene sensor (ID ${sensorId}) for group ${groupId}`,
        );
      }

      sceneSensorForGroup[groupId] = sensorId;
    }

    console.log(
      `scene-spy: Detected {groupId:sceneSensor} pairs: ${JSON.stringify(
        sceneSensorForGroup,
      )}`,
    );

    server.on('start', () => {
      console.log(`scene-spy: Starting polling Scene Sensors...`);
      startPolling(server, options);
    });
  }

  next();
};

exports.register.attributes = {
  name: 'scene-spy',
  version: '1.0.0',
};
