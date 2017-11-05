/*
 * virtualized-scenes
 */

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
  server.on('start', async () => {
    // Discover existing lights
    lights = await server.emitAwait('getLights');

    // Discover existing groups
    groups = await server.emitAwait('getGroups');

    server.on('setGroup', setGroup(server));
  });

  server.event('setGroup');

  next();
};

exports.register.attributes = {
  name: 'virtualized-groups',
  version: '1.0.0',
};
