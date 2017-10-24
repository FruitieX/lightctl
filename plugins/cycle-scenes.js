/*
 * cycle-scenes
 *
 * Allows cycling between given scenes.
 *
 * When given a list of sceneIds in a 'cycleScenes' event, the plugin
 * will activate the next scene in the list (or first scene if none of
 * them are currently active). Wraps around at end of scene list.
 *
 * cycleScenes event payload:
 * ```
 * {
 *   scenes: ['sceneId1', 'sceneId2', ...]
 * }
 * ```
 */

let activeScene = null;

const setScene = ({ sceneId }) => {
  activeScene = sceneId;
};

const cycleScenes = server => ({ scenes }) => {
  const currentIndex = scenes.indexOf(activeScene);

  server.emit('setScene', {
    sceneId: scenes[(currentIndex + 1) % scenes.length],
  });
};

exports.register = async function(server, options, next) {
  server.on('start', () => {
    server.on('setScene', setScene);
    server.on('cycleScenes', cycleScenes(server));
  });

  server.event('cycleScenes');

  next();
};

exports.register.attributes = {
  name: 'cycle-scenes',
  version: '1.0.0',
};
