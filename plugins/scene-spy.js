/*
 * scene-spy
 *
 * Store id of currently active scene in a Hue bridge sensor.
 * Any scene change through the API will trigger this function.
 * Any light state changes will reset the value to "null".
 *
 * SETUP:
 *
 * - Currently you have to create the sensor manually, for example using:
 * ```
 * http POST 192.168.1.111/api/$(cat ~/.hue_username)/sensors name="null"
 * modelid="Group 0 Scene Sensor" swversion="1" type="CLIPGenericStatus"
 * uniqueid="group0" manufacturername="Scene Sensor"
 * ```
 *
 * - Note down the returned ID, and modify SENSOR_ID below.
 *
 * - Register plugin in index.js:
 * ```
 * forwarder.register([{
 *   register: require('./plugins/scene-spy'),
 *   options: { groupId 0 } // Unused!
 * },
 * ...
 * ```
 *
 * - If you want your Dimmer Switches to also sync the active scene, append to
 *   actions of each dimmer switch rule:
 * ```
 * {
 *   "address": "/sensors/21",
 *   "method": "PUT",
 *   "body": {
 *     "name": "NFdJj2xpbz9mivi"
 *   }
 * }
 * ```
 *
 * TODO:
 *
 * - Support multiple groups (I only have one in my Hue setup)
 * - Automatically create missing sensors
 * - Automatically detect and use existing sensors
 */

const request = require('request');

const SENSOR_ID = 21;

const groupActionRegex = /\/api\/(\w+)\/groups\/(\d+)\/action/;
const lightStateRegex = /\/api\/(\w+)\/lights\/(\d+)\/state/;

const storeSceneId = (sceneId, username) =>
  request({
    url: `http://${process.env.HUE_IP}/api/${username}/sensors/${SENSOR_ID}`,
    method: 'PUT',
    body: JSON.stringify({ name: sceneId || 'null' }),
  });

const onPreHandler = (req, reply) => {
  let match;

  if (req.method === 'put') {
    if (match = req.path.match(groupActionRegex)) {
      // Scene changed for group
      const [ result, username, groupId ] = match;

      //console.log(`Group ${groupId} scene changed to: ${req.payload.scene}`);
      storeSceneId(req.payload.scene, username);
    } else if (match = req.path.match(lightStateRegex)) {
      // Light state changed, reset stored scene id to "null"
      const [ result, username, lightId ] = match;

      //console.log(`Light ${lightId} state changed, delta: ${JSON.stringify(req.payload)}`);
      storeSceneId(undefined, username);
    }
  }

  return reply.continue();
};

exports.register = function (server, options, next) {
  server.ext('onPreHandler', onPreHandler);
  next();
};

exports.register.attributes = {
  name: 'scene-spy',
  version: '1.0.0'
};
