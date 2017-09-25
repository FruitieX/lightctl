/*
 * scene-spy
 *
 * Store id of currently active scene in a Hue bridge sensor.
 * Any scene change through the API will trigger this function.
 * Any light state changes will reset the value to "null".
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
 *       options: { groups: [ 0, 1 ] }
 *     },
 * ...
 * ```
 *
 * - If you want your Dimmer Switches to also sync the active scene, append the
 *   following to the actions array of each dimmer switch rule (replace
 *   ${SENSOR_ID} and ${SCENE_ID} with relevant values):
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
 */

const request = require('request-promise-native');

const groupActionRegex = /\/api\/([\w-]+)\/groups\/(\d+)\/action/;
const lightStateRegex = /\/api\/([\w-]+)\/lights\/(\d+)\/state/;

let sensorForGroup = {};
let groups = {};

const storeSceneId = (sceneId, groupId, username) =>
  request({
    url: `http://${process.env.HUE_IP}/api/${username}/sensors/${sensorForGroup[groupId]}`,
    method: 'PUT',
    body: JSON.stringify({ name: sceneId || 'null' }),
  });

const onPreHandler = (req, reply) => {
  let match;

  if (req.method === 'put') {
    if (match = req.path.match(groupActionRegex)) {
      // Scene changed for group
      const [ result, username, groupId ] = match;

      console.log(`scene-spy: Group ${groupId} scene changed to: ${req.payload.scene}`);

      if (groupId !== 0) {
        storeSceneId(req.payload.scene, groupId, username);
      }

      // Any scene change results in group 0 (all lights) scene getting set!
      storeSceneId(req.payload.scene, 0, username);
    } else if (match = req.path.match(lightStateRegex)) {
      // Light state changed, reset stored scene id to "null"
      const [ result, username, lightId ] = match;

      // Figure out which group(s) light is part of
      // TODO: can a light be part of multiple groups?
      const groupId = Object.keys(groups).find(groupId =>
        groups[groupId].lights.includes(lightId)
      );

      console.log(`scene-spy: Light ${lightId} state changed, scene reset for group ${groupId}`);

      if (groupId !== 0) {
        storeSceneId(undefined, groupId, username);
      }

      // Any light state change results in group 0 (all lights) scene getting reset!
      storeSceneId(undefined, 0, username);
    }
  }

  return reply.continue();
};

exports.register = async function (server, options, next) {
  if (!process.env.USERNAME) {
    return next('scene-spy: USERNAME env var not supplied, aborting...');
  }

  server.ext('onPreHandler', onPreHandler);

  // Discover existing groups
  groups = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/groups`,
    json: true,
  });

  // Discover existing sensors in bridge
  const sensors = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/sensors`,
    json: true,
  });

  // Try matching groups to scene sensors
  for (let groupId in options.groups) {
    let sensorId = Object.keys(sensors).find(sensorId =>
      sensors[sensorId].modelid === `Group ${groupId} Scene Sensor`
    );

    if (sensorId === undefined) {
      // If scene sensor for group not found, create it
      const generated = await request({
        url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/sensors`,
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
      console.log(`scene-spy: Created scene sensor (ID ${sensorId}) for group ${groupId}`);
    }

    sensorForGroup[groupId] = sensorId;
  };

  console.log(`scene-spy: Detected {groupId:sceneSensor} pairs: ${JSON.stringify(sensorForGroup)}`);

  next();
};

exports.register.attributes = {
  name: 'scene-spy',
  version: '1.0.0'
};
