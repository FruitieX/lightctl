/*
 * groups
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
    server.events.emit('setLight', {
      lightId,
      payload,
    }),
  );

  server.events.emit('setScene', {
    sceneId: 'null',
  });
};

const register = async function(server, options) {
  server.events.on('start', async () => {
    // Discover existing lights
    lights = await server.emitAwait('getLights');

    // Discover existing groups
    groups = await server.emitAwait('getGroups');

    server.events.on('setGroup', setGroup(server));
  });

  server.event({ name: 'getGroups', clone: true });
  server.event('setGroup');
};

module.exports = {
  name: 'groups',
  version: '1.0.0',
  register,
};
