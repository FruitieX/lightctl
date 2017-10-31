/*
 * api-spy
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
 *       register: require('./plugins/api-spy'),
 *       options: {
 *         groups: [0, 1],
 *         pollDelay: 100,
 *         sceneSensors: true,
 *         autoCreateSensors: true,
 *       },
 *     },
 *   ...
 */

const request = require('request-promise-native');

const forEach = require('lodash/forEach');
const groupActionRegex = /\/api\/([\w-]+)\/groups\/(\d+)\/action/;
const lightStateRegex = /\/api\/([\w-]+)\/lights\/(\d+)\/state/;

let groups = {};

const onPreHandler = server => (req, reply) => {
  let match;

  if (req.method === 'put') {
    if ((match = req.path.match(groupActionRegex))) {
      const [result, username, groupId] = match;

      if (req.payload.scene) {
        // Scene changed for group
        console.log(
          `api-spy: Group ${groupId} scene changed to: ${req.payload.scene}`,
        );

        server.emit('setScene', {
          groupId,
          sceneId: req.payload.scene || 'null',
        });
      } else {
        server.emit('setGroup', {
          groupId,
          ...req.payload,
        });
      }

      const response = [];

      forEach(req.payload, (value, key) => {
        response.push({
          success: {
            [`/groups/${groupId}/action/${key}`]: value,
          },
        });
      });

      return reply(response);
    } else if ((match = req.path.match(lightStateRegex))) {
      // Light state changed, reset stored scene id to "null"
      const [result, username, lightId] = match;

      // Figure out which group(s) light is part of
      // TODO: support multiple groups
      const groupId = Object.keys(groups).find(groupId =>
        groups[groupId].lights.includes(lightId),
      );

      console.log(
        `api-spy: Light ${lightId} state changed, scene reset for group ${groupId}`,
      );

      server.emit('setScene', { groupId, sceneId: 'null' });
      server.emit('setLight', { lightId, payload: req.payload });

      const response = [];

      forEach(req.payload, (value, key) => {
        response.push({
          success: {
            [`/lights/${lightId}/state/${key}`]: value,
          },
        });
      });

      return reply(response);
    }
  }

  return reply.continue();
};

exports.register = async function(server, options, next) {
  if (!process.env.USERNAME) {
    return next('api-spy: USERNAME env var not supplied, aborting...');
  }

  server.ext('onPreHandler', onPreHandler(server));

  // Discover existing groups
  groups = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/groups`,
    timeout: 1000,
    json: true,
  });

  next();
};

exports.register.attributes = {
  name: 'api-spy',
  version: '1.0.0',
};
