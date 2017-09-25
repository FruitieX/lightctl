/*
 * scene-spy-ws
 *
 * Poll for scene-spy Scene Sensor changes and publish them over websockets.
 *
 * DEPENDENCIES:
 *
 * - scene-spy
 * - ws-server
 *
 * SETUP:
 *
 * - Register dependencies and plugin in index.js:
 *
 * ```
 * server.register(
 *   [
 *     require('./plugins/ws-server'),
 *     {
 *       register: require('./plugins/scene-spy'),
 *       options: { groups: [ 0, 1 ] }
 *     },
 *     {
 *       register: require('./plugins/scene-spy-ws'),
 *       options: { groups: [ 0 ] },
 *     },
 *     ...
 *   ]
 * ...
 * ```
 */

const request = require('request-promise-native');

const sensorForGroup = require('./scene-spy').sensorForGroup;
const sceneForGroup = {};

const delay = ms =>
  new Promise((resolve, reject) =>
    setTimeout(resolve, ms)
  );

const startPolling = async (server, options) => {
  while (true) {
    for (let groupId in options.groups) {
      sensor = await request({
        url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/sensors/${sensorForGroup[groupId]}`,
        json: true,
      });

      if (sensor.name !== sceneForGroup[groupId]) {
        // Scene changed! Notify websockets
        console.log('scene-spy-ws: Scene change detected!');
        server.publish(`/groups/${groupId}`, { groupId, scene: sensor.name });
      }

      sceneForGroup[groupId] = sensor.name;
      await delay(100);
    }
  }
};

exports.register = async function (server, options, next) {
  server.dependency(['scene-spy', 'ws-server']);
  if (!server.subscription) {
    return next('scene-spy-ws: ws-server plugin must be loaded before me, aborting...');
  }

  server.subscription('/groups/{groupId}');

  server.on('start', () => {
    startPolling(server, options);
  });

  next();
};

exports.register.attributes = {
  name: 'scene-spy-ws',
  version: '1.0.0'
};
