/*
 * virtualized-scenes
 */

const request = require('request-promise-native');

let groups = {};
let lights = {};

const setGroup = server => ({ groupId, ...payload }) => {
  const group = groups[groupId];

  let groupLights = [];

  if (group) {
    groupLights = group.lights;
  } else {
    // default to all lights
    groupLights = Object.keys(lights);
  }

  groupLights.forEach(lightId =>
    server.emit('setLight', {
      lightId,
      payload,
    }),
  );

  server.emit('setScene', {
    sceneId: 'null',
  });
};

exports.register = async function(server, options, next) {
  // Discover existing lights
  lights = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/lights`,
    timeout: 1000,
    json: true,
  });

  // Discover existing groups
  groups = await request({
    url: `http://${process.env.HUE_IP}/api/${process.env.USERNAME}/groups`,
    timeout: 1000,
    json: true,
  });

  server.on('start', () => {
    server.on('setGroup', setGroup(server));
  });

  server.event('setGroup');

  next();
};

exports.register.attributes = {
  name: 'virtualized-groups',
  version: '1.0.0',
};
